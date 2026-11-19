/**
 * Đơn vị tính và quy cách thùng của một SKU — BE `UomConversionController`
 * (`/products/{id}/variants/{variantId}/uom-conversions`, quyền `product-products:READ` / `UPDATE`).
 * Docs 01 §3 "Đơn vị quy đổi" (BR-09, BR-10) và "Quy cách thùng" (BR-03): đơn vị thùng là MỘT đơn vị
 * quy đổi, hệ số = số cái chuẩn / thùng, kèm kích thước thùng (D×R×C) và khối lượng thùng đầy.
 */

import { z } from "zod";

import { UI_LABELS } from "@/constants";
import { canonicalDecimal, DECIMAL_TEXT, travelsExactly } from "@/lib/validation/decimal";

export {
  beUomConversionSchema,
  cartonOf,
  isCartonCandidate,
  type CartonLookup,
  type UomConversion,
} from "@/lib/domain/carton";

import type { UomConversion } from "@/lib/domain/carton";

/** BE `CartonSpec.measured`: đủ kích thước + khối lượng thùng đầy thì mới in được nhãn giao (08 BR-07). */
export const cartonMeasured = (unit: UomConversion): boolean =>
  [unit.lengthCm, unit.widthCm, unit.heightCm, unit.weightKg].every((v) => v != null && v > 0);

/** Thể tích thùng (m³) từ kích thước cm; null khi thiếu cạnh. */
export function cartonVolumeM3(unit: UomConversion): number | null {
  const { lengthCm, widthCm, heightCm } = unit;
  if (lengthCm == null || widthCm == null || heightCm == null) return null;
  return (lengthCm * widthCm * heightCm) / 1_000_000;
}

/* ── Input ───────────────────────────────────────────────────────────── */

const V = UI_LABELS.cartonSpec.validation;

/**
 * Cột `inventory.uom_conversions`: `length/width/height_cm numeric(10,2)`, `weight_kg numeric(10,3)` —
 * tối đa 8 / 7 chữ số phần nguyên. Ô trống = chưa khai báo (BE nhận null, `CartonSpec.measured` false).
 */
function optionalMeasure(scale: number, message: string) {
  const integerDigits = 10 - scale;
  return z
    .string()
    .trim()
    .refine((raw) => {
      if (raw === "") return true;
      if (!DECIMAL_TEXT.test(raw)) return false;
      const value = canonicalDecimal(raw);
      const [whole = "", fraction = ""] = value.split(".");
      return (
        Number(value) > 0 &&
        whole.length <= integerDigits &&
        fraction.length <= scale &&
        travelsExactly(value)
      );
    }, message);
}

/** Form khai báo / sửa thùng — chuỗi người dùng gõ; đổi sang body BE khi gửi. */
export const cartonSpecFormSchema = z.object({
  // BE `CreateUomConversionRequest.unitOfMeasure` @Pattern
  unitOfMeasure: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{1,16}$/, V.unitOfMeasure),
  // BR-03: hệ số = số cái chuẩn / thùng; thùng phải > 1 cái mới là quy cách thùng (`cartonCandidate`)
  unitsPerCarton: z
    .string()
    .trim()
    .refine((v) => /^\d{1,9}$/.test(v) && Number(v) >= 2, V.unitsPerCarton),
  lengthCm: optionalMeasure(2, V.size),
  widthCm: optionalMeasure(2, V.size),
  heightCm: optionalMeasure(2, V.size),
  weightKg: optionalMeasure(3, V.weight),
  defaultShipping: z.boolean(),
});
export type CartonSpecFormValues = z.infer<typeof cartonSpecFormSchema>;

const decimalOrNull = (raw: string): number | null =>
  raw.trim() === "" ? null : Number(canonicalDecimal(raw.trim()));
const text = (value: number | null | undefined): string => (value == null ? "" : String(value));

/** Thùng đang có → giá trị form; chưa có → mặc định `CARTON`, là đơn vị giao mặc định. */
export function cartonFormValuesOf(carton: UomConversion | null): CartonSpecFormValues {
  return {
    unitOfMeasure: carton?.unitOfMeasure ?? "CARTON",
    unitsPerCarton: carton ? String(carton.factor) : "",
    lengthCm: text(carton?.lengthCm),
    widthCm: text(carton?.widthCm),
    heightCm: text(carton?.heightCm),
    weightKg: text(carton?.weightKg),
    defaultShipping: carton?.defaultShipping ?? true,
  };
}

/** Phần chung của `CreateUomConversionRequest` / `UpdateUomConversionRequest`. */
export function cartonUnitBody(values: CartonSpecFormValues) {
  return {
    unitOfMeasure: values.unitOfMeasure.trim(),
    factor: Number(values.unitsPerCarton.trim()),
    lengthCm: decimalOrNull(values.lengthCm),
    widthCm: decimalOrNull(values.widthCm),
    heightCm: decimalOrNull(values.heightCm),
    weightKg: decimalOrNull(values.weightKg),
    defaultShipping: values.defaultShipping,
  };
}
