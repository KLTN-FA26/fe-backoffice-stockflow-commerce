/**
 * Danh mục loại xe (BE PR #153 `VehicleTypeController`, docs 09 §3) — DTO trả về, parse tại biên API.
 * BE `default-property-inclusion: non_null`: `rentalPrice` chưa đặt thì vắng mặt → `.nullish()`.
 */

import { z } from "zod";

import { VEHICLE_TYPE_KINDS, VEHICLE_TYPE_STATUSES } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

/** BE serialise BigDecimal thành số JSON; nhận cả chuỗi số, chặn NaN. */
const beDecimal = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

/** BE `VehicleTypeResponse`: kích thước trong và khe góc bằng mm, tải trọng bằng kg. */
export const beVehicleTypeSchema = z.object({
  vehicleTypeId: z.string(),
  code: z.string(),
  name: z.string(),
  kind: z.enum(VEHICLE_TYPE_KINDS),
  innerLengthMm: z.number().int(),
  innerWidthMm: z.number().int(),
  innerHeightMm: z.number().int(),
  /** Khe chừa ở mỗi góc trên trần (docs 09 BR-10). */
  gussetMm: z.number().int(),
  maxPayloadKg: beDecimal,
  availableCount: z.number().int(),
  rentalPrice: beDecimal.nullish(),
  /** Loại xe mặc định: không xoá, không đổi mã. */
  preset: z.boolean(),
  status: z.enum(VEHICLE_TYPE_STATUSES),
  /** Gửi lại khi sửa (409 OPTIMISTIC_LOCK nếu đã đổi). */
  version: z.number().int(),
});

export const beVehicleTypePageSchema = bePageSchema(beVehicleTypeSchema);
