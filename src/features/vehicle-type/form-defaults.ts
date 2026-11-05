/**
 * Giá trị khởi tạo của form loại xe: form trống khi thêm, và dòng hiện có → chuỗi ô nhập khi sửa.
 * `SERVER_FIELDS` là các ô mà lỗi `fieldErrors` của BE được gắn vào.
 */

import { VEHICLE_TYPE_KIND, VEHICLE_TYPE_STATUS } from "@/constants";

import type { VehicleType, VehicleTypeFormInput } from "./types";

export const SERVER_FIELDS = [
  "name",
  "kind",
  "innerLengthMm",
  "innerWidthMm",
  "innerHeightMm",
  "gussetMm",
  "doorWidthMm",
  "doorHeightMm",
  "maxPayloadKg",
  "availableCount",
  "rentalPrice",
  "status",
] as const;

export const EMPTY_VEHICLE_TYPE_FORM: VehicleTypeFormInput = {
  code: "",
  name: "",
  kind: VEHICLE_TYPE_KIND.TRUCK,
  innerLengthMm: "",
  innerWidthMm: "",
  innerHeightMm: "",
  gussetMm: "",
  doorWidthMm: "",
  doorHeightMm: "",
  maxPayloadKg: "",
  availableCount: "1",
  rentalPrice: "",
  status: VEHICLE_TYPE_STATUS.ACTIVE,
};

export const formValuesOf = (row: VehicleType): VehicleTypeFormInput => ({
  code: row.code,
  name: row.name,
  kind: row.kind,
  innerLengthMm: String(row.innerLengthMm),
  innerWidthMm: String(row.innerWidthMm),
  innerHeightMm: String(row.innerHeightMm),
  gussetMm: String(row.gussetMm),
  doorWidthMm: row.doorWidthMm == null ? "" : String(row.doorWidthMm),
  doorHeightMm: row.doorHeightMm == null ? "" : String(row.doorHeightMm),
  maxPayloadKg: String(row.maxPayloadKg),
  availableCount: String(row.availableCount),
  rentalPrice: row.rentalPrice == null ? "" : String(row.rentalPrice),
  status: row.status,
});

/** Một ô mà bản mới của BE (người khác vừa lưu) khác giá trị người dùng đang nhập. */
export interface FormConflict {
  field: Exclude<keyof VehicleTypeFormInput, "code">;
  mine: string;
  theirs: string;
}

/**
 * So giá trị đang nhập với bản mới của BE sau khi người khác sửa trước: chỉ liệt kê ô khác nhau, để người
 * dùng quyết định giữ phần mình hay nạp bản mới — không ô nào bị ghi đè âm thầm. Mã không đổi nên bỏ qua.
 */
export function conflictsOf(
  server: VehicleType,
  mine: Partial<VehicleTypeFormInput>,
): FormConflict[] {
  const theirs = formValuesOf(server);
  const fields = (Object.keys(theirs) as (keyof VehicleTypeFormInput)[]).filter(
    (field): field is FormConflict["field"] => field !== "code",
  );
  return fields
    .filter((field) => (mine[field] ?? "").trim() !== theirs[field].trim())
    .map((field) => ({ field, mine: (mine[field] ?? "").trim(), theirs: theirs[field] }));
}
