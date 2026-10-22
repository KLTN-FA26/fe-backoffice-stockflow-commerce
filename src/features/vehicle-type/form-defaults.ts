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
  maxPayloadKg: String(row.maxPayloadKg),
  availableCount: String(row.availableCount),
  rentalPrice: row.rentalPrice == null ? "" : String(row.rentalPrice),
  status: row.status,
});
