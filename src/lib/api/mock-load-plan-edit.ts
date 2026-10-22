/**
 * Mock `PUT /fulfillment/load-plans/{id}/placements` theo `LoadPlan.editPlacements` của BE PR #161: chỉ khi PLANNED; nguyên
 * tử; mọi xe và mọi kiện đúng một lần (400 `VALIDATION_FAILED` + mã trường); luật xếp BR-10 từng xe (`PlacementValidator`:
 * ngoài thùng, chồng, đỡ < 98%, quá tải — field `vehicle:<seq>`, xoay, cửa) và bộ không tách xe (`KIT_SPLIT`, khay tính là
 * một chỗ) → 422 `PLACEMENT_RULE_VIOLATION` với `fieldErrors[{field: ref, code: rule}]`. Xe để trống rời kế hoạch.
 * Tái dùng hình học thuần của F1 (không chép lại công thức).
 */

import { LAYOUT_ORIENTATIONS, PLACEMENT_RULE_LABELS } from "@/constants";
import { extentOf, orientedExtent } from "@/features/load-planning/lib/dims";
import { validatePlacement } from "@/features/load-planning/lib/manual-packing";

import { heldParcels, parcelIndex } from "./mock-load-plan-view";
import { fail } from "./mock-route-utils";
import { getVehicleTypeStore } from "./mock-vehicle-type-store";

import type { LayoutOrientation, PlacementRule } from "@/constants";
import type { MockResponseShape } from "./mock-route-utils";
import type { MockParcel, MockPlan, MockPlanVehicle } from "./mock-load-plan-store";

type Box = MockPlanVehicle["boxes"][number];
interface Violation {
  field: string;
  code: PlacementRule | string;
}

const num = (value: unknown): number => (typeof value === "number" ? value : Number.NaN);
const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const badEdit = (problems: Violation[]) =>
  fail(
    400,
    "VALIDATION_FAILED",
    "The edit does not describe this plan",
    problems.map(({ field, code }) => ({ field, code, message: code })),
  );

/** Hướng mà (w, h, d) suy ra từ kích thước danh định; null nếu không hướng nào cho đúng cỡ này (BE `Orientation.of`). */
function orientationOf(parcel: MockParcel, box: Box): LayoutOrientation | null {
  const orig = { l: parcel.lengthMm, w: parcel.widthMm, h: parcel.heightMm };
  return (
    LAYOUT_ORIENTATIONS.find((o) => {
      const e = orientedExtent(orig, o);
      return e.wMm === box.wMm && e.hMm === box.hMm && e.dMm === box.dMm;
    }) ?? null
  );
}

function vehicleViolations(
  vehicle: MockPlanVehicle,
  parcels: Map<string, MockParcel>,
): Violation[] {
  const type = getVehicleTypeStore().get(vehicle.vehicleTypeId);
  const extent = extentOf(vehicle.innerMm);
  const out: Violation[] = [];
  let load = 0;
  for (const box of vehicle.boxes) {
    const parcel = parcels.get(box.packageId);
    if (!parcel) continue;
    load += parcel.weightKg;
    const at = (code: PlacementRule) => out.push({ field: box.packageId, code });
    const pose = orientationOf(parcel, box);
    if (!pose || (!parcel.rotatable && pose !== "LWH")) at("ROTATION_NOT_ALLOWED");
    const others = vehicle.boxes.filter((o) => o.packageId !== box.packageId);
    for (const rule of validatePlacement(box, extent, others).violations) at(rule);
    const tooWide = type?.doorWidthMm != null && box.wMm > type.doorWidthMm;
    const tooTall = type?.doorHeightMm != null && box.hMm > type.doorHeightMm;
    if (tooWide || tooTall) at("DOOR");
    if (box.orientation && pose && box.orientation !== pose) at("ORIENTATION_MISMATCH");
  }
  if (load > vehicle.maxPayloadKg)
    out.push({ field: `vehicle:${vehicle.seq}`, code: "OVERWEIGHT" });
  return out;
}

/** LP-3: các kiện của một bộ ở hai chỗ (xe khác nhau, hoặc xe và khay) → mọi kiện của bộ bị báo. */
function kitViolations(
  vehicles: MockPlanVehicle[],
  tray: string[],
  parcels: Map<string, MockParcel>,
): Violation[] {
  const where = new Map<string, Set<string>>();
  const members: { id: string; group: string }[] = [];
  const note = (id: string, place: string) => {
    const group = parcels.get(id)?.kitGroupId;
    if (!group) return;
    members.push({ id, group });
    where.set(group, (where.get(group) ?? new Set()).add(place));
  };
  vehicles.forEach((v) => v.boxes.forEach((b) => note(b.packageId, String(v.seq))));
  tray.forEach((id) => note(id, "tray"));
  return members
    .filter((m) => (where.get(m.group)?.size ?? 0) > 1)
    .map((m) => ({ field: m.id, code: "KIT_SPLIT" }));
}

export function editPlacements(
  plan: MockPlan,
  body: Record<string, unknown>,
): MockResponseShape | null {
  if (plan.status !== "PLANNED")
    return fail(
      409,
      "INVALID_LOAD_PLAN_TRANSITION",
      "The load plan cannot do that in its current status",
    );
  const parcels = parcelIndex();
  const held = new Set(heldParcels(plan).map((p) => p.packageId));
  const problems: Violation[] = [];
  const seen = new Set<string>();
  const track = (id: string) =>
    seen.has(id) ? problems.push({ field: id, code: "LOAD_PLAN_PACKAGE_DUPLICATE" }) : seen.add(id);
  const listed = new Set<number>();
  const edited: MockPlanVehicle[] = [];
  for (const raw of list(body.vehicles)) {
    const entry = record(raw);
    const current = plan.vehicles.find((v) => v.seq === num(entry.seq));
    if (!current)
      problems.push({ field: `vehicles[${String(entry.seq)}]`, code: "LOAD_PLAN_VEHICLE_UNKNOWN" });
    else if (listed.has(current.seq))
      problems.push({ field: `vehicles[${current.seq}]`, code: "LOAD_PLAN_VEHICLE_DUPLICATE" });
    else listed.add(current.seq);
    const boxes = list(entry.boxes).map((b): Box => {
      const box = record(b);
      track(String(box.ref));
      return {
        packageId: String(box.ref),
        xMm: num(box.xMm),
        yMm: num(box.yMm),
        zMm: num(box.zMm),
        wMm: num(box.wMm),
        hMm: num(box.hMm),
        dMm: num(box.dMm),
        orientation: typeof box.orientation === "string" ? box.orientation : "",
      };
    });
    if (current) edited.push({ ...current, boxes, needsRecalculation: false });
  }
  for (const v of plan.vehicles)
    if (!listed.has(v.seq))
      problems.push({ field: `vehicles[${v.seq}]`, code: "LOAD_PLAN_VEHICLE_MISSING" });
  const tray = list(body.tray).map(String);
  tray.forEach(track);
  for (const id of seen)
    if (!held.has(id)) problems.push({ field: id, code: "LOAD_PLAN_PACKAGE_UNKNOWN" });
  for (const id of held)
    if (!seen.has(id)) problems.push({ field: id, code: "LOAD_PLAN_PACKAGE_MISSING" });
  if (problems.length > 0) return badEdit(problems);

  const violations = [
    ...edited.flatMap((v) => vehicleViolations(v, parcels)),
    ...kitViolations(edited, tray, parcels),
  ];
  if (violations.length > 0)
    return fail(
      422,
      "PLACEMENT_RULE_VIOLATION",
      `${violations.length} placement(s) break a loading rule; nothing was changed`,
      violations.map(({ field, code }) => ({
        field,
        code,
        message: PLACEMENT_RULE_LABELS[code as PlacementRule] ?? code,
      })),
    );

  const before = new Set(plan.unplaced.keys());
  plan.vehicles = edited.filter((v) => v.boxes.length > 0);
  plan.unplaced = new Map(tray.map((id) => [id, plan.unplaced.get(id) ?? "MANUAL"]));
  const after = new Set(plan.unplaced.keys());
  // BE xoá xác nhận BR-13 khi tập kiện chưa xếp đổi (`LoadPlan.editPlacements`)
  if (before.size !== after.size || [...before].some((id) => !after.has(id)))
    plan.acknowledgement = null;
  plan.version += 1;
  return null;
}
