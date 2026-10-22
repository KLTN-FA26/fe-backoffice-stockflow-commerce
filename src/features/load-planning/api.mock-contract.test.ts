/**
 * Contract mock kế hoạch xếp xe (BE PR #161): chạy handler mock thật qua `resolveMockRoute` rồi parse bằng schema FE.
 * Mock giữ đúng mã lỗi / mã quyền / vòng đời: DRAFT → PLANNED → CONFIRMED, BR-09, BR-13, BR-14, LP-4, OPTIMISTIC_LOCK.
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
  fieldsOf,
  newRequestId,
  vehicleTypeId,
} from "./__fixtures__/mock-contract";
import { LAYOUT_PICKUP_KIT } from "./__fixtures__/layouts";
import { checkLayout } from "./lib/layout-check";
import {
  beCandidateListSchema,
  beLayoutListSchema,
  bePlanDetailSchema,
  bePlanRowPageSchema,
} from "./plan-schemas";
import { beReconciliationSchema } from "./reconciliation-schemas";

import type { PlanDetail } from "./plan-types";

beforeEach(() => {
  resetLoadPlanMockStore();
  resetVehicleTypeMockStore();
  actAs(DISPATCHER);
});

const detailOf = async (id: string): Promise<PlanDetail> =>
  bePlanDetailSchema.parse((await call("GET", `${PATH}/${id}`)).data);

/** Lập một kế hoạch mới từ một lô và một loại xe, tính xếp xe; trả kế hoạch sau khi tính. */
async function planOf(shipmentId: string, warehouseId: string, typeCode: string) {
  const created = await call("POST", PATH, {
    requestId: newRequestId(),
    warehouseId,
    shipmentIds: [shipmentId],
    vehicleTypeIds: [await vehicleTypeId(typeCode)],
  });
  const draft = bePlanDetailSchema.parse(created.data);
  const calculated = await call("POST", `${PATH}/${draft.loadPlanId}/calculation`, {
    expectedVersion: draft.version,
  });
  return { draft, response: calculated, plan: bePlanDetailSchema.parse(calculated.data) };
}

describe("danh sách và chi tiết", () => {
  it("lists the four seeded plans newest first and every row parses", async () => {
    const page = bePlanRowPageSchema.parse((await call("GET", PATH, undefined, {})).data);
    expect(page.totalElements).toBe(4);
    expect(page.items.map((row) => row.status).sort()).toEqual([
      "CANCELLED",
      "CONFIRMED",
      "DRAFT",
      "PLANNED",
    ]);
    expect(page.items[0].createdAt >= page.items[1].createdAt).toBe(true);
  });

  it("filters by status, warehouse and code search; rejects an unknown status", async () => {
    const byStatus = bePlanRowPageSchema.parse(
      (await call("GET", PATH, undefined, { status: "DRAFT" })).data,
    );
    expect(byStatus.items.map((r) => r.code)).toEqual(["LP-20261022-0002"]);
    const byWarehouse = bePlanRowPageSchema.parse(
      (await call("GET", PATH, undefined, { warehouseId: "WH-HCM-01" })).data,
    );
    expect(byWarehouse.totalElements).toBe(1);
    const bySearch = bePlanRowPageSchema.parse(
      (await call("GET", PATH, undefined, { search: "0004" })).data,
    );
    expect(bySearch.items[0].code).toBe("LP-20261021-0004");
    expect(errorCode(await call("GET", PATH, undefined, { status: "RUNNING" }))).toBe(
      "VALIDATION_FAILED",
    );
  });

  it("serves the PLANNED plan built from the F1 pickup fixture, with a valid layout", async () => {
    const plan = await detailOf(SEED.planned);
    expect(plan).toMatchObject({
      status: "PLANNED",
      placedCount: 23,
      unplacedCount: 0,
      version: 4,
    });
    expect(plan.vehicles[0]).toMatchObject({ seq: 1, packageCount: 23, needsRecalculation: false });
    const layouts = beLayoutListSchema.parse(
      (await call("GET", `${PATH}/${SEED.planned}/layouts`)).data,
    );
    expect(layouts).toHaveLength(1);
    expect(layouts[0].boxes).toHaveLength(LAYOUT_PICKUP_KIT.boxes.length);
    expect(checkLayout(layouts[0])).toEqual([]);
  });

  it("serves one vehicle's layout and 404s a missing plan or vehicle", async () => {
    expect((await call("GET", `${PATH}/${SEED.planned}/vehicles/1/layout`)).status).toBe(200);
    expect(errorCode(await call("GET", `${PATH}/${SEED.planned}/vehicles/9/layout`))).toBe(
      "LOAD_PLAN_VEHICLE_NOT_FOUND",
    );
    expect(errorCode(await call("GET", `${PATH}/nope`))).toBe("LOAD_PLAN_NOT_FOUND");
  });
});

describe("ứng viên và lập kế hoạch (BR-09, idempotent)", () => {
  it("lists the free full-truckload shipments of the warehouse, not the ones a live plan holds", async () => {
    const res = await call("GET", "/fulfillment/load-plan-candidates", undefined, {
      warehouseId: "WH-HN-01",
    });
    const rows = beCandidateListSchema.parse(res.data);
    expect(rows.map((r) => r.shipmentId)).toEqual([SEED.bigShipment]);
    expect(rows[0]).toMatchObject({ allowPartialShipment: false, packagesInOtherPlans: 0 });
    expect(rows[0].packages).toHaveLength(rows[0].packageCount);
  });

  it("counts a plan's own shipments as free when asked with its loadPlanId", async () => {
    const res = await call("GET", "/fulfillment/load-plan-candidates", undefined, {
      warehouseId: "WH-HN-01",
      loadPlanId: SEED.draft,
    });
    expect(beCandidateListSchema.parse(res.data)).toHaveLength(2);
  });

  it("creates a DRAFT, and a second POST with the same requestId returns that same plan", async () => {
    const body = {
      requestId: newRequestId(),
      warehouseId: "WH-HN-01",
      shipmentIds: [SEED.bigShipment],
      vehicleTypeIds: [await vehicleTypeId("PICKUP")],
    };
    const first = await call("POST", PATH, body);
    const replay = await call("POST", PATH, body);
    expect(first.status).toBe(201);
    const a = bePlanDetailSchema.parse(first.data);
    expect(a).toMatchObject({ status: "DRAFT", selectionMode: "SINGLE_TYPE", version: 0 });
    expect(bePlanDetailSchema.parse(replay.data).loadPlanId).toBe(a.loadPlanId);
    expect((await call("GET", PATH, undefined, {})).data).toMatchObject({ totalElements: 5 });
  });

  it("refuses a shipment a live plan already holds, one of another warehouse, and an unknown mode", async () => {
    const base = { warehouseId: "WH-HN-01", vehicleTypeIds: [await vehicleTypeId("PICKUP")] };
    const taken = await call("POST", PATH, {
      ...base,
      requestId: newRequestId(),
      shipmentIds: [SEED.kitShipment],
    });
    expect([taken.status, errorCode(taken)]).toEqual([409, "LOAD_PLAN_PACKAGE_TAKEN"]);
    const other = await call("POST", PATH, {
      ...base,
      requestId: newRequestId(),
      shipmentIds: [SEED.hcmShipment],
    });
    expect(errorCode(other)).toBe("SHIPMENT_NOT_FOR_LOAD");
    const mode = await call("POST", PATH, {
      ...base,
      requestId: newRequestId(),
      shipmentIds: [],
      selectionMode: "BEST",
    });
    expect(fieldsOf(mode)[0].field).toBe("selectionMode");
  });

  it("needs :CREATE to create and :READ to look", async () => {
    actAs(VIEWER);
    expect(
      (await call("POST", PATH, { requestId: newRequestId(), warehouseId: "WH-HN-01" })).status,
    ).toBe(403);
    expect((await call("GET", PATH, undefined, {})).status).toBe(200);
    actAs([]);
    expect((await call("GET", PATH, undefined, {})).status).toBe(403);
  });
});

describe("tính xếp xe và kiện chưa xếp (BR-13, LP-4)", () => {
  it("calculates a plan: PLANNED, vehicles with fill %, the oversized parcels unplaced as TOO_LARGE", async () => {
    const { plan, draft } = await planOf(SEED.bigShipment, "WH-HN-01", "PICKUP");
    expect(plan).toMatchObject({ status: "PLANNED", version: draft.version + 1, unplacedCount: 2 });
    expect(plan.vehicles.length).toBeGreaterThanOrEqual(1);
    expect(plan.placedCount + plan.unplacedCount).toBe(plan.packageCount);
    const tray = plan.packages.filter((p) => p.vehicleSeq === undefined);
    expect(tray.map((p) => p.unplacedReason)).toEqual(["TOO_LARGE", "TOO_LARGE"]);
    for (const vehicle of plan.vehicles) expect(vehicle.volumeFillPct).toBeGreaterThan(0);
    const layouts = beLayoutListSchema.parse(
      (await call("GET", `${PATH}/${plan.loadPlanId}/layouts`)).data,
    );
    for (const layout of layouts) {
      const hard = checkLayout(layout).filter((issue) => issue.rule !== "UNSUPPORTED");
      expect(hard).toEqual([]);
    }
  });

  it("refuses to confirm until the unplaced parcels are acknowledged, then LP-4 stops an order that may not ship in parts", async () => {
    const { plan } = await planOf(SEED.bigShipment, "WH-HN-01", "PICKUP");
    const confirm = await call("POST", `${PATH}/${plan.loadPlanId}/confirmation`, {
      expectedVersion: plan.version,
    });
    expect(errorCode(confirm)).toBe("LOAD_PLAN_UNPLACED_NOT_ACKNOWLEDGED");
    const ack = await call("POST", `${PATH}/${plan.loadPlanId}/unplaced-acknowledgement`, {
      expectedVersion: plan.version,
    });
    expect([ack.status, errorCode(ack)]).toEqual([409, "ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED"]);
    expect(fieldsOf(ack)[0]).toMatchObject({ field: "orderNumber", message: "SO-20261006-000004" });
  });

  it("an order that allows partial shipment: acknowledge, confirm, load per vehicle, parcels left behind", async () => {
    const { plan } = await planOf(SEED.hcmShipment, "WH-HCM-01", "PICKUP");
    expect(plan.unplacedCount).toBe(4);
    const ack = bePlanDetailSchema.parse(
      (
        await call("POST", `${PATH}/${plan.loadPlanId}/unplaced-acknowledgement`, {
          expectedVersion: plan.version,
        })
      ).data,
    );
    expect(ack.unplacedAcknowledgement).toBeDefined();
    const confirmed = bePlanDetailSchema.parse(
      (
        await call("POST", `${PATH}/${plan.loadPlanId}/confirmation`, {
          expectedVersion: ack.version,
        })
      ).data,
    );
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.unplacedCount).toBe(0);
    for (const vehicle of confirmed.vehicles) expect(vehicle.load?.status).toBe("PLANNED");
    // Kiện bị để lại được đếm riêng ở đối chiếu và sổ vẫn cân
    const rec = beReconciliationSchema.parse(
      (await call("GET", `${PATH}/${plan.loadPlanId}/reconciliation`)).data,
    );
    expect(rec.pieceCheck).toMatchObject({ leftBehind: 4, unplaced: 4, balanced: true });
  });

  it("recalculating one vehicle with parcels from the tray moves what fits and keeps the rest unplaced", async () => {
    const { plan } = await planOf(SEED.hcmShipment, "WH-HCM-01", "TRUCK-1T25");
    expect(plan.unplacedCount).toBe(0);
    const res = await call("POST", `${PATH}/${plan.loadPlanId}/vehicles/9/recalculation`, {
      expectedVersion: plan.version,
    });
    expect(errorCode(res)).toBe("LOAD_PLAN_VEHICLE_NOT_FOUND");
    const again = bePlanDetailSchema.parse(
      (
        await call("POST", `${PATH}/${plan.loadPlanId}/vehicles/1/recalculation`, {
          expectedVersion: plan.version,
        })
      ).data,
    );
    expect(again.version).toBe(plan.version + 1);
    expect(again.placedCount + again.unplacedCount).toBe(plan.packageCount);
  });
});

describe("đồng thời, mở lại, huỷ (BR-14)", () => {
  it("any write with a stale expectedVersion is 409 OPTIMISTIC_LOCK", async () => {
    const stale = await call("POST", `${PATH}/${SEED.planned}/confirmation`, {
      expectedVersion: 1,
    });
    expect([stale.status, errorCode(stale)]).toEqual([409, "OPTIMISTIC_LOCK"]);
    const putStale = await call("PUT", `${PATH}/${SEED.draft}/inputs`, {
      expectedVersion: 99,
      shipmentIds: [],
      vehicleTypeIds: [],
    });
    expect(errorCode(putStale)).toBe("OPTIMISTIC_LOCK");
  });

  it("a step the status does not allow is INVALID_LOAD_PLAN_TRANSITION", async () => {
    const draft = await detailOf(SEED.draft);
    const res = await call("POST", `${PATH}/${draft.loadPlanId}/confirmation`, {
      expectedVersion: draft.version,
    });
    expect(errorCode(res)).toBe("INVALID_LOAD_PLAN_TRANSITION");
  });

  it("changing the inputs of a PLANNED plan sends it back to DRAFT and drops its vehicles", async () => {
    const plan = await detailOf(SEED.planned);
    const res = await call("PUT", `${PATH}/${plan.loadPlanId}/inputs`, {
      expectedVersion: plan.version,
      shipmentIds: [SEED.kitShipment],
      vehicleTypeIds: [await vehicleTypeId("PICKUP")],
      selectionMode: "FEWEST_VEHICLES",
    });
    expect(bePlanDetailSchema.parse(res.data)).toMatchObject({
      status: "DRAFT",
      vehicles: [],
      selectionMode: "FEWEST_VEHICLES",
    });
  });

  it("reopening and cancelling need a reason; with it a confirmed plan goes back to PLANNED and its loads are dropped", async () => {
    const { plan } = await planOf(SEED.hcmShipment, "WH-HCM-01", "TRUCK-1T25");
    const confirmed = bePlanDetailSchema.parse(
      (
        await call("POST", `${PATH}/${plan.loadPlanId}/confirmation`, {
          expectedVersion: plan.version,
        })
      ).data,
    );
    const blank = await call("POST", `${PATH}/${plan.loadPlanId}/reopening`, {
      expectedVersion: confirmed.version,
      reason: " ",
    });
    expect(fieldsOf(blank)[0].field).toBe("reason");
    const reopened = bePlanDetailSchema.parse(
      (
        await call("POST", `${PATH}/${plan.loadPlanId}/reopening`, {
          expectedVersion: confirmed.version,
          reason: "Đổi xe",
        })
      ).data,
    );
    expect(reopened).toMatchObject({ status: "PLANNED", reopenReason: "Đổi xe" });
    expect(reopened.vehicles.every((v) => v.load === undefined)).toBe(true);
    const cancelled = bePlanDetailSchema.parse(
      (
        await call("POST", `${PATH}/${plan.loadPlanId}/cancellation`, {
          expectedVersion: reopened.version,
          reason: "Khách huỷ",
        })
      ).data,
    );
    expect(cancelled).toMatchObject({ status: "CANCELLED", cancelReason: "Khách huỷ" });
  });

  it("BR-14: once a vehicle is loading, reopening or cancelling is 409 LOAD_PLAN_LOADING_STARTED", async () => {
    const plan = await detailOf(SEED.loading);
    expect(plan.vehicles[0].load?.status).toBe("LOADING");
    for (const step of ["reopening", "cancellation"])
      expect(
        errorCode(
          await call("POST", `${PATH}/${plan.loadPlanId}/${step}`, {
            expectedVersion: plan.version,
            reason: "x",
          }),
        ),
      ).toBe("LOAD_PLAN_LOADING_STARTED");
  });

  it("every step needs :UPDATE", async () => {
    actAs(VIEWER);
    const plan = await detailOf(SEED.planned);
    expect(
      (
        await call("POST", `${PATH}/${plan.loadPlanId}/confirmation`, {
          expectedVersion: plan.version,
        })
      ).status,
    ).toBe(403);
  });
});

describe("đối chiếu với ước lượng", () => {
  it("a plan with one estimated order: the piece check balances and the advisory flags are set", async () => {
    const rec = beReconciliationSchema.parse(
      (await call("GET", `${PATH}/${SEED.planned}/reconciliation`)).data,
    );
    expect(rec.pieceCheck).toMatchObject({
      packagesIn: 23,
      placed: 23,
      unplaced: 0,
      balanced: true,
    });
    expect(rec.vsEstimate?.vehiclesCompared).toBe(true);
    expect(rec.vsEstimate?.flags).toEqual(expect.arrayContaining(["VOLUME_ABOVE", "WEIGHT_ABOVE"]));
    expect(rec.vsEstimate?.notEstimated).toEqual([]);
  });

  it("a plan whose order has no estimate reports it and leaves vsEstimate out while nothing is placed", async () => {
    const draft = await detailOf(SEED.draft);
    const rec = beReconciliationSchema.parse(
      (await call("GET", `${PATH}/${draft.loadPlanId}/reconciliation`)).data,
    );
    expect(rec.vsEstimate).toBeUndefined();
    expect(rec.pieceCheck.packagesIn).toBe(8);
  });
});
