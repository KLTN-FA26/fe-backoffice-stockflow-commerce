/**
 * Form tạo / sửa loại xe — phản chiếu `VehicleTypeRequest` / `VehicleTypeUpdateRequest` của BE PR #153
 * (docs 09 §3). Ô nhập là chuỗi; schema kiểm rồi đổi sang số. Backend phải re-check mọi rule dưới đây.
 *  - Kích thước trong 1..30000 mm; khe góc 0..1000 mm (BR-10, tuỳ chọn, trống = 0 / giữ nguyên);
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

/** Số nguyên tuỳ chọn: trống → `undefined` (BE: 0 khi tạo, giữ nguyên khi sửa). */
function optionalWholeNumber(max: number, belowMessage: string, aboveMessage: string) {
  return z
    .string()
    .trim()
    .refine((v) => v === "" || INTEGER.test(v), MSG.integerRequired)
    .refine((v) => v === "" || Number(v) >= 0, belowMessage)
    .refine((v) => v === "" || Number(v) <= max, aboveMessage)
    .transform((v) => (v === "" ? undefined : Number(v)));
}

const dimension = () =>
  wholeNumber(1, LIMITS.dimensionMaxMm, MSG.dimensionPositive, MSG.dimensionTooLarge);

export const vehicleTypeFormSchema = z.object({
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
  gussetMm?: number;
  maxPayloadKg: number;
  availableCount: number;
  rentalPrice?: number;
  status: VehicleTypeFormValues["status"];
}
