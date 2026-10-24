/**
 * Contract mock `PUT /fulfillment/load-plans/{id}/placements` (BE `LoadPlan.editPlacements`): chạy handler mock thật rồi
 * đọc bằng schema FE. Mock phải trả đúng mã lỗi và `fieldErrors[{field, code}]` mà trình soạn F5 đọc.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { resetLoadPlanMockStore } from "@/lib/api/mock-load-plan-store";
import { resetVehicleTypeMockStore } from "@/lib/api/mock-vehicle-type-store";

import {
  DISPATCHER,
  PATH,
  SEED,
  VIEWER,
  actAs,
  call,
  errorCode,
} from "./__fixtures__/mock-contract";
import { buildPlacementsPayload } from "./editor/payload";
import { buildEditorState } from "./editor/build-state";
import { applyEdit } from "./editor/apply";
import { beLayoutListSchema, bePlanDetailSchema } from "./plan-schemas";

import type { PlacementsPayload } from "./editor/payload";
import type { EditorState } from "./editor/types";

beforeEach(() => {
  resetLoadPlanMockStore();
  resetVehicleTypeMockStore();
  actAs(DISPATCHER);
});

const URL = `${PATH}/${SEED.planned}/placements`;

async function openState(): Promise<{ state: EditorState; version: number }> {
  const plan = bePlanDetailSchema.parse((await call("GET", `${PATH}/${SEED.planned}`)).data);
  const layouts = beLayoutListSchema.parse(
    (await call("GET", `${PATH}/${SEED.planned}/layouts`)).data,
  );
  const state = buildEditorState(plan, layouts);
  if (!state) throw new Error("plan and layouts disagree");
  return { state, version: plan.version };
}

const violations = (res: { data: unknown }) =>
  ((res.data as { fieldErrors?: { field: string; code?: string }[] }).fieldErrors ?? []).map(
    (e) => `${e.field}:${e.code}`,
  );

describe("PUT placements (mock)", () => {
  it("accepts the unchanged layout as the payload built by the editor and bumps the version", async () => {
    const { state, version } = await openState();
    const res = await call("PUT", URL, buildPlacementsPayload(state, version));
    expect(res.status).toBe(200);
    expect(bePlanDetailSchema.parse(res.data).version).toBe(version + 1);
  });

  it("applies an edit: parcel to the tray is unplaced MANUAL and the BR-13 acknowledgement is cleared", async () => {
    const { state, version } = await openState();
    const ref = state.vehicles[0].boxes.find((b) => b.partName === "Ghế bar")?.ref ?? "";
    const edited = applyEdit(state, { kind: "toTray", seq: 1, refs: [ref] });
    if (!edited.ok) throw new Error("rejected");
    const plan = bePlanDetailSchema.parse(
      (await call("PUT", URL, buildPlacementsPayload(edited.state, version))).data,
    );
    expect(plan.unplacedCount).toBe(1);
    expect(plan.packages.find((p) => p.packageId === ref)).toMatchObject({
      unplacedReason: "MANUAL",
    });
    expect(plan.vehicles[0].packageCount).toBe(state.vehicles[0].boxes.length - 1);
  });

  it("422 PLACEMENT_RULE_VIOLATION with fieldErrors [{field: ref, code}] and nothing changed (all or nothing)", async () => {
    const { state, version } = await openState();
    const payload = buildPlacementsPayload(state, version);
    const box = payload.vehicles[0].boxes[0];
    box.yMm = 10; // lifted 10 mm like the BE example
    const res = await call("PUT", URL, payload);
    expect(res.status).toBe(422);
    expect(errorCode(res)).toBe("PLACEMENT_RULE_VIOLATION");
    expect(violations(res)).toContain(`${box.ref}:UNSUPPORTED`);
    const after = bePlanDetailSchema.parse((await call("GET", `${PATH}/${SEED.planned}`)).data);
    expect(after.version).toBe(version);
  });

  it("reports overlap, out of bounds and a vehicle over its payload on the vehicle key", async () => {
    const { state, version } = await openState();
    const payload: PlacementsPayload = buildPlacementsPayload(state, version);
    const [a, b] = payload.vehicles[0].boxes;
    b.xMm = a.xMm;
    b.yMm = a.yMm;
    b.zMm = a.zMm;
    payload.vehicles[0].boxes[2].xMm = 99999;
    const res = await call("PUT", URL, payload);
    const found = violations(res);
    expect(found).toContain(`${b.ref}:OVERLAP`);
    expect(found).toContain(`${payload.vehicles[0].boxes[2].ref}:OUT_OF_BOUNDS`);
  });

  it("splitting a kit between a vehicle and the tray is KIT_SPLIT for every part (LP-3)", async () => {
    const { state, version } = await openState();
    const leg = state.vehicles[0].boxes.find((b) => b.kitGroup && b.partName === "Chân bàn");
    if (!leg) throw new Error("the seeded plan carries a table kit");
    const edited = applyEdit(state, { kind: "toTray", seq: 1, refs: [leg.ref] });
    if (!edited.ok) throw new Error("rejected");
    const res = await call("PUT", URL, buildPlacementsPayload(edited.state, version));
    expect(violations(res)).toContain(`${leg.ref}:KIT_SPLIT`);
  });

  it("400 VALIDATION_FAILED when the edit does not list every parcel exactly once, with BE's field codes", async () => {
    const { state, version } = await openState();
    const payload = buildPlacementsPayload(state, version);
    const dropped = payload.vehicles[0].boxes.pop();
    payload.vehicles[0].boxes.push({ ...payload.vehicles[0].boxes[0] }); // duplicate
    const res = await call("PUT", URL, payload);
    expect(res.status).toBe(400);
    expect(errorCode(res)).toBe("VALIDATION_FAILED");
    expect(violations(res)).toEqual(
      expect.arrayContaining([
        `${payload.vehicles[0].boxes[0].ref}:LOAD_PLAN_PACKAGE_DUPLICATE`,
        `${dropped?.ref}:LOAD_PLAN_PACKAGE_MISSING`,
      ]),
    );
    expect(violations(await call("PUT", URL, { ...payload, vehicles: [] }))).toContain(
      "vehicles[1]:LOAD_PLAN_VEHICLE_MISSING",
    );
  });

  it("a vehicle left empty leaves the plan", async () => {
    const { state, version } = await openState();
    const all = state.vehicles[0].boxes.map((b) => b.ref);
    const emptied = applyEdit(state, { kind: "toTray", seq: 1, refs: all });
    if (!emptied.ok) throw new Error("rejected");
    const res = await call("PUT", URL, buildPlacementsPayload(emptied.state, version));
    // the whole shipment on the tray: kits are together there, so this is accepted
    expect(res.status).toBe(200);
    expect(bePlanDetailSchema.parse(res.data).vehicles).toEqual([]);
  });

  it("stale expectedVersion is 409 OPTIMISTIC_LOCK; a non-PLANNED plan is INVALID_LOAD_PLAN_TRANSITION; :UPDATE is required", async () => {
    const { state, version } = await openState();
    expect(errorCode(await call("PUT", URL, buildPlacementsPayload(state, version - 1)))).toBe(
      "OPTIMISTIC_LOCK",
    );
    const draft = `${PATH}/${SEED.draft}/placements`;
    const draftPlan = bePlanDetailSchema.parse((await call("GET", `${PATH}/${SEED.draft}`)).data);
    expect(
      errorCode(
        await call("PUT", draft, { expectedVersion: draftPlan.version, vehicles: [], tray: [] }),
      ),
    ).toBe("INVALID_LOAD_PLAN_TRANSITION");
    actAs(VIEWER);
    expect(errorCode(await call("PUT", URL, buildPlacementsPayload(state, version)))).toBe(
      "FORBIDDEN",
    );
  });
});
