/**
 * Quy tắc của mock danh mục loại xe — theo `VehicleTypeService.fill` của BE PR #153: kiểm các trường dùng chung
 * của POST / PUT. PUT thay thế toàn bộ (khe góc vắng = 0, giá thuê vắng = xoá, status vắng = giữ nguyên), loại xe
 * mặc định giữ `kind`, khe góc phải vừa thùng (`ck_vehicle_type_gusset_fits`).
 */

import { VEHICLE_TYPE_KINDS, VEHICLE_TYPE_LIMITS, VEHICLE_TYPE_STATUSES } from "@/constants";

import { readString } from "./mock-routes-purchase-orders-store";

import type {
  MockVehicleKind,
  MockVehicleStatus,
  MockVehicleType,
} from "./mock-vehicle-type-store";

// `includes` trên chuỗi người dùng gửi lên nên nới kiểu tuple về `readonly string[]`
const KINDS: readonly string[] = VEHICLE_TYPE_KINDS;
export const STATUSES: readonly string[] = VEHICLE_TYPE_STATUSES;
const L = VEHICLE_TYPE_LIMITS;

export type Problems = { field: string; message: string; code?: string }[];

const intIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

/** `VehicleTypeService.fill`: kiểm các trường dùng chung; trả bản ghi mới + danh sách lỗi theo trường. */
export function fill(
  body: Record<string, unknown>,
  row: MockVehicleType,
): { next: MockVehicleType; problems: Problems } {
  const problems: Problems = [];
  const name = readString(body.name);
  if (!name || name.length > L.nameMax)
    problems.push({ field: "name", message: "required, at most 120 characters" });
  const kind = readString(body.kind).toUpperCase();
  if (!KINDS.includes(kind))
    problems.push({ field: "kind", message: "CONTAINER, TRUCK or PICKUP" });
  else if (row.preset && kind !== row.kind)
    problems.push({
      field: "kind",
      message: "a preset keeps its kind",
      code: "VEHICLE_TYPE_KIND_IMMUTABLE",
    });
  const sides = (["innerLengthMm", "innerWidthMm", "innerHeightMm"] as const).map((field) => {
    const ok = intIn(body[field], 1, L.dimensionMaxMm);
    if (!ok) problems.push({ field, message: `1 to ${L.dimensionMaxMm} mm` });
    return ok ? (body[field] as number) : 1;
  });
  const gusset = body.gussetMm === undefined || body.gussetMm === null ? 0 : body.gussetMm;
  if (!intIn(gusset, 0, L.gussetMaxMm))
    problems.push({ field: "gussetMm", message: `0 to ${L.gussetMaxMm} mm` });
  // ck_vehicle_type_gusset_fits: bộ xếp bỏ khe không vừa nên BE từ chối
  else if (2 * gusset >= (sides[1] ?? 1) || gusset >= (sides[2] ?? 1))
    problems.push({
      field: "gussetMm",
      message:
        "twice the gusset must be less than the inner width, and the gusset less than the inner height",
    });
  const payload = body.maxPayloadKg;
  const payloadOk = typeof payload === "number" && payload > 0 && payload <= L.payloadMaxKg;
  if (!payloadOk)
    problems.push({ field: "maxPayloadKg", message: "more than 0 and at most 100000 kg" });
  if (!intIn(body.availableCount, 0, L.availableCountMax))
    problems.push({ field: "availableCount", message: `0 to ${L.availableCountMax}` });
  const price = typeof body.rentalPrice === "number" ? body.rentalPrice : null;
  if (price !== null && price < 0) problems.push({ field: "rentalPrice", message: "0 or more" });
  const status = readString(body.status).toUpperCase() || row.status;
  if (!STATUSES.includes(status)) problems.push({ field: "status", message: "ACTIVE or INACTIVE" });
  return {
    problems,
    next: {
      ...row,
      name,
      kind: kind as MockVehicleKind,
      innerLengthMm: sides[0] ?? 1,
      innerWidthMm: sides[1] ?? 1,
      innerHeightMm: sides[2] ?? 1,
      gussetMm: typeof gusset === "number" ? gusset : 0,
      maxPayloadKg: payloadOk ? payload : 1,
      availableCount: typeof body.availableCount === "number" ? body.availableCount : 0,
      rentalPrice: price,
      status: status as MockVehicleStatus,
    },
  };
}
