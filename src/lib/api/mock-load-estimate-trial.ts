/**
 * Mock "Ước tính thử" (SCRUM-474 TRIAL-FLOW, LP2-9; BE `POST /fulfillment/load-estimates/trial`): kiểm yêu cầu như BE
 * (dòng, kích thước, giới hạn 3 000 kiện, loại xe) rồi trả một bố cục cố định từ fixture `Layout` — mock KHÔNG xếp
 * thật theo danh sách gửi lên, chỉ để màn chạm được mọi trạng thái. Không lưu gì (đúng như BE).
 */

import { LOAD_ESTIMATE_LIMITS, TRIAL_MAX_BOXES, TRIAL_MAX_MM } from "@/constants";
import { LAYOUT_40HC, UNPLACED_40HC } from "@/features/load-planning/__fixtures__/layouts";

import { fail, ok } from "./mock-route-utils";
import { getVehicleTypeStore } from "./mock-vehicle-type-store";

import type { MockResponseShape } from "./mock-route-utils";

const invalid = (field: string, code: string) =>
  fail(400, "VALIDATION_FAILED", `${field} is invalid`, [{ field, message: "is invalid", code }]);

const isMm = (value: unknown): boolean =>
  typeof value === "number" && Number.isInteger(value) && value > 0 && value <= TRIAL_MAX_MM;

export function mockTrialEstimate(body: Record<string, unknown>): MockResponseShape {
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0) return invalid("lines", "NotEmpty");
  let boxes = 0;
  for (const [index, raw] of lines.entries()) {
    const line = (raw ?? {}) as Record<string, unknown>;
    for (const field of ["lengthMm", "widthMm", "heightMm"])
      if (!isMm(line[field])) return invalid(`lines[${index}].${field}`, "Max");
    const quantity = line.quantity;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0)
      return invalid(`lines[${index}].quantity`, "Positive");
    boxes += quantity;
  }
  if (boxes > TRIAL_MAX_BOXES)
    return fail(422, "LOAD_ESTIMATE_TOO_MANY_CARTONS", `The list makes ${boxes} boxes`);
  const ids = Array.isArray(body.vehicleTypeIds) ? body.vehicleTypeIds : [];
  if (ids.length > LOAD_ESTIMATE_LIMITS.vehicleTypesMax) return invalid("vehicleTypeIds", "Size");
  const types = getVehicleTypeStore();
  for (const id of ids) {
    const type = typeof id === "string" ? types.get(id) : undefined;
    if (!type) return fail(404, "VEHICLE_TYPE_NOT_FOUND", "Vehicle type not found");
    if (type.status !== "ACTIVE")
      return fail(409, "VEHICLE_TYPE_INACTIVE", `${type.code} is not in use`);
  }
  return ok({
    trial: true,
    selectionMode: body.selectionMode === "FEWEST_VEHICLES" ? "FEWEST_VEHICLES" : "SINGLE_TYPE",
    vehicleTypeIds: ids,
    vehicles: [LAYOUT_40HC],
    unplaced: UNPLACED_40HC.map((line) => ({
      ...line,
      sourceRef: null,
      reason: "NO_SPACE",
      refs: [],
    })),
    meta: {
      budgetMillis: 5000,
      budgetExhausted: false,
      elapsedMillis: 640,
      placedBoxes: LAYOUT_40HC.boxes.length,
      unplacedBoxes: UNPLACED_40HC.reduce((sum, line) => sum + line.quantity, 0),
      kitWarnings: [],
    },
  });
}
