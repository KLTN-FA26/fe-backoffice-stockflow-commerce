/**
 * Đơn vị tính / thùng của một SKU — BE `UomConversionResponse` và luật chọn thùng `UomConversion.cartonOf`
 * (kltn-docs 01 §3 "Quy cách thùng", BR-03, BR-11). Đặt ở `lib/domain` để feature sản phẩm (khai báo thùng) và
 * feature giá khách (hiện số cái / thùng) dùng chung mà không import chéo feature.
 */

import { z } from "zod";

/** BE serialise BigDecimal thành số JSON; nhận cả chuỗi số, chặn NaN. */
const beDecimal = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

/** BE `UomConversionResponse` — đơn vị cơ sở có `factor` 1 và cỡ / khối lượng của chính hồ sơ hàng tồn. */
export const beUomConversionSchema = z.object({
  id: z.string(),
  sku: z.string(),
  unitOfMeasure: z.string(),
  factor: z.number().int(),
  base: z.boolean(),
  weightKg: beDecimal.nullish(),
  lengthCm: beDecimal.nullish(),
  widthCm: beDecimal.nullish(),
  heightCm: beDecimal.nullish(),
  defaultPurchase: z.boolean(),
  active: z.boolean(),
  version: z.number().int(),
  defaultShipping: z.boolean().default(false),
});
export type UomConversion = z.infer<typeof beUomConversionSchema>;

/**
 * BE `UomConversion.cartonCandidate` (docs 01 BR-03): đơn vị đóng gói còn dùng, hơn một cái — có ít nhất
 * một thì SKU "có quy cách thùng" (preflight `CARTON_SPEC_MISSING` hỏi đúng câu này).
 */
export const isCartonCandidate = (unit: UomConversion): boolean =>
  unit.active && !unit.base && unit.factor > 1;

/** Kết quả tìm thùng của SKU theo đúng luật BE `UomConversion.cartonOf`. */
export type CartonLookup =
  | { kind: "carton"; carton: UomConversion }
  | { kind: "none" }
  /** Nhiều đơn vị đóng gói, không cái nào là đơn vị giao mặc định: BE không đoán (01 BR-03, BR-11). */
  | { kind: "ambiguous"; candidates: UomConversion[] };

export function cartonOf(units: readonly UomConversion[]): CartonLookup {
  const candidates = units.filter(isCartonCandidate);
  const narrowed = candidates.length > 1 ? candidates.filter((u) => u.defaultShipping) : candidates;
  const [only] = narrowed;
  if (narrowed.length === 1 && only) return { kind: "carton", carton: only };
  return candidates.length === 0 ? { kind: "none" } : { kind: "ambiguous", candidates };
}
