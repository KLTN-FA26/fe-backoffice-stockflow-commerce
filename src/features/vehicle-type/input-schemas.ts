/**
 * Form tạo / sửa loại xe — phản chiếu `VehicleTypeRequest` / `VehicleTypeUpdateRequest` của BE PR #153
 * (docs 09 §3). Ô nhập là chuỗi; schema kiểm rồi đổi sang số. Backend phải re-check mọi rule dưới đây.
 *  - Kích thước trong 1..30000 mm; khe góc 0..1000 mm (BR-10, tuỳ chọn, trống = 0) và phải vừa thùng:
 *    2 × khe góc < rộng trong, khe góc < cao trong (`ck_vehicle_type_gusset_fits`);
 *  - cửa thùng (tuỳ chọn, trống = không giới hạn cửa): 1..30000 mm, rộng cửa ≤ rộng trong, cao cửa ≤ cao
 *    trong (`ck_vehicle_type_door_*`; LP3-DOOR: bộ xếp từ chối kiện không lọt cửa);
 *  - tải trọng > 0 và ≤ 100000 kg, tối đa 3 số lẻ; số xe 0..10000;
 *  - giá thuê ≥ 0 (tuỳ chọn, chỉ để tham khảo — docs 09 §4.2).
 */

import { z } from "zod";

import {
  VEHICLE_TYPE_FIELD_MESSAGES as MSG,
  VEHICLE_TYPE_KINDS,
  VEHICLE_TYPE_LIMITS as LIMITS,
  VEHICLE_TYPE_STATUSES,
} from "@/constants";

/** `ck_vehicle_type_code` sau khi BE viết hoa: `[A-Z0-9][A-Z0-9_-]{1,31}`. */
export const VEHICLE_TYPE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/;

const INTEGER = /^-?\d+$/;
const payloadDecimal = new RegExp(`^-?\\d+(\\.\\d{1,${LIMITS.payloadFractionDigits}})?$`);
const priceDecimal = new RegExp(
  `^\\d{1,${LIMITS.rentalPriceIntegerDigits}}(\\.\\d{1,${LIMITS.rentalPriceFractionDigits}})?$`,
);

/** Người dùng Việt gõ dấu phẩy thập phân; BE nhận dấu chấm. */
const normalise = (raw: string) => raw.trim().replace(",", ".");

/** Số nguyên bắt buộc trong [min, max]. */
function wholeNumber(min: number, max: number, belowMessage: string, aboveMessage: string) {
  return z
    .string()
    .trim()
    .min(1, MSG.numberRequired)
    .regex(INTEGER, MSG.integerRequired)
    .refine((v) => Number(v) >= min, belowMessage)
    .refine((v) => Number(v) <= max, aboveMessage)
    .transform(Number);
}

/** Số nguyên tuỳ chọn: trống → 0 (BE: PUT thay thế toàn bộ, khe góc vắng = 0). */
function optionalWholeNumber(max: number, belowMessage: string, aboveMessage: string) {
  return z
    .string()
    .trim()
    .refine((v) => v === "" || INTEGER.test(v), MSG.integerRequired)
    .refine((v) => v === "" || Number(v) >= 0, belowMessage)
    .refine((v) => v === "" || Number(v) <= max, aboveMessage)
    .transform((v) => (v === "" ? 0 : Number(v)));
}

/** Số nguyên tuỳ chọn trong [1, max]: trống → `null` (BE: PUT thay thế toàn bộ, cửa vắng = không giới hạn). */
function optionalPositiveNumber(max: number, message: string) {
  return z
    .string()
    .trim()
    .refine((v) => v === "" || INTEGER.test(v), MSG.integerRequired)
    .refine((v) => v === "" || !INTEGER.test(v) || (Number(v) >= 1 && Number(v) <= max), message)
    .transform((v) => (v === "" ? null : Number(v)));
}

const dimension = () =>
  wholeNumber(1, LIMITS.dimensionMaxMm, MSG.dimensionPositive, MSG.dimensionTooLarge);

const vehicleTypeFields = z.object({
  code: z
    .string()
    .trim()
    .min(1, MSG.codeRequired)
    .regex(VEHICLE_TYPE_CODE_PATTERN, MSG.codePattern),
  name: z.string().trim().min(1, MSG.nameRequired).max(LIMITS.nameMax, MSG.nameTooLong),
  kind: z.enum(VEHICLE_TYPE_KINDS),
  innerLengthMm: dimension(),
  innerWidthMm: dimension(),
  innerHeightMm: dimension(),
  gussetMm: optionalWholeNumber(LIMITS.gussetMaxMm, MSG.gussetNegative, MSG.gussetTooLarge),
  doorWidthMm: optionalPositiveNumber(LIMITS.doorMaxMm, MSG.doorInvalid),
  doorHeightMm: optionalPositiveNumber(LIMITS.doorMaxMm, MSG.doorInvalid),
  maxPayloadKg: z
    .string()
    .transform(normalise)
    .pipe(
      z
        .string()
        .min(1, MSG.numberRequired)
        .regex(payloadDecimal, MSG.payloadFraction)
        .refine((v) => Number(v) > 0, MSG.payloadPositive)
        .refine((v) => Number(v) <= LIMITS.payloadMaxKg, MSG.payloadTooLarge)
        .transform(Number),
    ),
  availableCount: wholeNumber(0, LIMITS.availableCountMax, MSG.countNegative, MSG.countTooLarge),
  rentalPrice: z
    .string()
    .transform(normalise)
    .pipe(
      z
        .string()
        .refine((v) => v === "" || !v.startsWith("-"), MSG.priceNegative)
        .refine((v) => v === "" || v.startsWith("-") || priceDecimal.test(v), MSG.priceDigits)
        .transform((v) => (v === "" ? undefined : Number(v))),
    ),
  status: z.enum(VEHICLE_TYPE_STATUSES),
});

/**
 * Khe góc phải vừa thùng (BE `VEHICLE_TYPE_GUSSET_TOO_LARGE`): bộ xếp bỏ khe không vừa nên BE từ chối.
 * Cửa không được lớn hơn thùng (BE `VEHICLE_TYPE_DOOR_TOO_LARGE`): rộng cửa ≤ rộng trong, cao cửa ≤ cao trong.
 * Chỉ kiểm khi các số đã hợp lệ — lỗi từng ô đã nói trước.
 */
export const vehicleTypeFormSchema = vehicleTypeFields.superRefine((v, ctx) => {
  const { gussetMm, innerWidthMm, innerHeightMm, doorWidthMm, doorHeightMm } = v;
  if (typeof innerWidthMm === "number" && typeof innerHeightMm === "number") {
    if (
      typeof gussetMm === "number" &&
      gussetMm <= LIMITS.gussetMaxMm &&
      (2 * gussetMm >= innerWidthMm || gussetMm >= innerHeightMm)
    )
      ctx.addIssue({ code: "custom", path: ["gussetMm"], message: MSG.gussetTooLargeForBox });
    if (
      typeof doorWidthMm === "number" &&
      doorWidthMm <= LIMITS.doorMaxMm &&
      doorWidthMm > innerWidthMm
    )
      ctx.addIssue({ code: "custom", path: ["doorWidthMm"], message: MSG.doorTooLargeForWidth });
    if (
      typeof doorHeightMm === "number" &&
      doorHeightMm <= LIMITS.doorMaxMm &&
      doorHeightMm > innerHeightMm
    )
      ctx.addIssue({ code: "custom", path: ["doorHeightMm"], message: MSG.doorTooLargeForHeight });
  }
});

/** Giá trị ô nhập (chuỗi) và giá trị đã kiểm (số) của form. */
export type VehicleTypeFormInput = z.input<typeof vehicleTypeFormSchema>;
export type VehicleTypeFormValues = z.output<typeof vehicleTypeFormSchema>;

/** Body `POST /vehicle-types` / `PUT /vehicle-types/{id}` (sửa thêm `version`). */
export interface VehicleTypeBody {
  code: string;
  name: string;
  kind: VehicleTypeFormValues["kind"];
  innerLengthMm: number;
  innerWidthMm: number;
  innerHeightMm: number;
  /** Luôn gửi (PUT thay thế toàn bộ): trống = 0. */
  gussetMm: number;
  /** Luôn gửi (PUT thay thế toàn bộ): trống = null = không giới hạn cửa. */
  doorWidthMm: number | null;
  doorHeightMm: number | null;
  maxPayloadKg: number;
  availableCount: number;
  rentalPrice?: number;
  status: VehicleTypeFormValues["status"];
}
