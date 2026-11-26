/**
 * Bậc giá theo thùng — phần chung của bảng giá riêng của khách (BE `CustomerPrice`, kltn-docs 13 BR-05) và giá chuẩn theo
 * quy cách (BE `StandardPrice`, 13 BR-04 sửa ngày 2026-11-26). Hai bảng giá dùng cùng luật BE (`PriceTiers`,
 * `SellingPrice`): 1–20 bậc, mỗi bậc từ `minQuantity` thùng (≥ 1, không trùng) một đơn giá VND nguyên > 0 cho một cái;
 * BE tự sắp bậc tăng dần, MOQ = bậc nhỏ nhất (BE tính).
 *
 * Tiền: BE `BigDecimal` qua JSON number → số thực của trình duyệt. FE giữ đơn giá là CHUỖI chữ số
 * (`lib/validation/decimal`) và chặn giá không đi qua JSON nguyên vẹn được, không làm tròn ngầm.
 */

import { z } from "zod";

import { PRICE_TIER_FIELD_MESSAGES as M, PRICE_TIER_LIMITS as L } from "@/constants";
import { canonicalDecimal, DECIMAL_TEXT, travelsExactly } from "@/lib/validation/decimal";

/* ── DTO (BE → FE) ───────────────────────────────────────────────────── */

/**
 * Đơn giá BE (số JSON, hoặc chuỗi số) → chuỗi chữ số chuẩn + `unitPriceExact`. Số JSON lớn hơn
 * `Number.MAX_SAFE_INTEGER` đã có thể bị `JSON.parse` làm tròn trước khi tới đây — không khôi phục được,
 * nên đánh dấu `unitPriceExact: false` (field của FE, không phải của BE) để màn hình không gửi lại số đó.
 */
export const bePriceTierSchema = z
  .object({
    minQuantity: z.number().int().min(L.minQuantityMin),
    unitPrice: z.union([z.number().positive(), z.string().regex(DECIMAL_TEXT)]),
  })
  .transform(({ minQuantity, unitPrice }) => ({
    minQuantity,
    unitPrice: typeof unitPrice === "number" ? String(unitPrice) : canonicalDecimal(unitPrice),
    unitPriceExact: typeof unitPrice === "string" || Number.isSafeInteger(unitPrice),
  }));
export type PriceTier = z.infer<typeof bePriceTierSchema>;

/* ── Input (FE → BE) ─────────────────────────────────────────────────── */

/** BE `SellingPrice`: > 0, VND nguyên (bỏ 0 cuối: "100.00" hợp lệ), tối đa 16 chữ số phần nguyên. */
const unitPriceText = z
  .string()
  .trim()
  .superRefine((raw, ctx) => {
    const canonical = DECIMAL_TEXT.test(raw) ? canonicalDecimal(raw) : "";
    const whole = canonical !== "" && !canonical.includes(".") && canonical !== "0";
    if (!whole || canonical.length > L.priceIntegerDigitsMax) {
      ctx.addIssue({ code: "custom", message: M.unitPrice });
    } else if (!travelsExactly(canonical)) {
      ctx.addIssue({ code: "custom", message: M.unitPricePrecision });
    }
  })
  .transform(canonicalDecimal);

const tierInputSchema = z.object({
  minQuantity: z
    .number({ message: M.minQuantity })
    .int(M.minQuantity)
    .min(L.minQuantityMin, M.minQuantity)
    .max(L.intMax, M.minQuantity),
  unitPrice: unitPriceText,
});

/**
 * Giá trị một bảng giá (tạo hoặc thay). Thứ tự bậc tuỳ ý (BE sắp lại); `note` phải CÓ MẶT — null để
 * xoá: PUT thay cả ghi chú, thiếu ghi chú là xoá ghi chú cũ (BE `replace`).
 */
export const priceTierValuesSchema = z.object({
  tiers: z
    .array(tierInputSchema)
    .min(1, M.tiersCount)
    .max(L.tiersMax, M.tiersCount)
    // BE `PriceTiers`: hai bậc không cùng `minQuantity` — báo ở mọi bậc trùng
    .superRefine((tiers, ctx) => {
      const counts = new Map<number, number>();
      for (const t of tiers) counts.set(t.minQuantity, (counts.get(t.minQuantity) ?? 0) + 1);
      tiers.forEach((t, i) => {
        if ((counts.get(t.minQuantity) ?? 0) > 1) {
          ctx.addIssue({
            code: "custom",
            path: [i, "minQuantity"],
            message: M.minQuantityDuplicate,
          });
        }
      });
    }),
  // BE `@Size(max = 500)` trên chuỗi gốc; trống / chỉ khoảng trắng → null (BE `noteOf`)
  note: z
    .string()
    .max(L.noteMax, M.note)
    .nullable()
    .transform((note) => (note === null || note.trim() === "" ? null : note)),
});
export type PriceTierValues = z.input<typeof priceTierValuesSchema>;
export type ValidPriceTierValues = z.output<typeof priceTierValuesSchema>;

/** BE PUT / DELETE: `version` bắt buộc (`@PositiveOrZero Long`, thiếu → 400). */
export const priceVersionSchema = z.number({ message: M.version }).int(M.version).min(0, M.version);

/**
 * Body `tiers` + `note` của BE. Đơn giá đã qua `travelsExactly` nên `Number` ở đây in lại đúng chữ số khi
 * `JSON.stringify`. Tạo: KHÔNG có `version` (BE: vắng = tạo). Thay: thêm `version`.
 */
export function toPriceTierBody(values: ValidPriceTierValues) {
  return {
    tiers: values.tiers.map((t) => ({
      minQuantity: t.minQuantity,
      unitPrice: Number(t.unitPrice),
    })),
    note: values.note,
  };
}

/** Bậc theo `minQuantity` tăng dần (BE đã sắp; sắp lại trên bản sao cho chắc). */
export function tiersAscending<T extends { minQuantity: number }>(tiers: readonly T[]): T[] {
  return [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
}
