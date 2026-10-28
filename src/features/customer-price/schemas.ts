/**
 * Bảng giá riêng của khách hàng — BE `CustomerPriceController` (`/api/v1/catalog/customer-prices`),
 * `CustomerPriceRequest` / `CustomerPriceResponse`, domain `CustomerPrice` + `SellingPrice`.
 * Luật nghiệp vụ: docs/handoffs/SPRINT2-PRICING-PLAN.md P3 — giá áp dụng tới khi sửa (KHÔNG có ngày
 * hiệu lực); bậc đầu không bắt buộc từ 1; giá không bắt buộc giảm dần; MOQ = `minQuantity` nhỏ nhất
 * (BE tính, không nhập riêng); BE tự sắp bậc tăng dần; tiền tệ luôn VND (không có trong DTO).
 *
 * Tiền: BE `BigDecimal` qua JSON number → số thực của trình duyệt. FE giữ đơn giá là CHUỖI chữ số
 * (`lib/validation/decimal`) và chặn giá không đi qua JSON nguyên vẹn được, không làm tròn ngầm.
 */

import { z } from "zod";

import { CUSTOMER_PRICE_FIELD_MESSAGES as M, CUSTOMER_PRICE_LIMITS as L } from "@/constants";
import { canonicalDecimal, DECIMAL_TEXT, travelsExactly } from "@/lib/validation/decimal";
import { omittedOrNull } from "@/lib/validation/primitives";

/* ── DTO (BE → FE) ───────────────────────────────────────────────────── */

/**
 * Đơn giá BE (số JSON, hoặc chuỗi số) → chuỗi chữ số chuẩn + `unitPriceExact`. Số JSON lớn hơn
 * `Number.MAX_SAFE_INTEGER` đã có thể bị `JSON.parse` làm tròn trước khi tới đây — không khôi phục được,
 * nên đánh dấu `unitPriceExact: false` (field của FE, không phải của BE) để màn hình không gửi lại số đó.
 */
const beTierSchema = z
  .object({
    minQuantity: z.number().int().min(L.minQuantityMin),
    unitPrice: z.union([z.number().positive(), z.string().regex(DECIMAL_TEXT)]),
  })
  .transform(({ minQuantity, unitPrice }) => ({
    minQuantity,
    unitPrice: typeof unitPrice === "number" ? String(unitPrice) : canonicalDecimal(unitPrice),
    unitPriceExact: typeof unitPrice === "string" || Number.isSafeInteger(unitPrice),
  }));
export type CustomerPriceTier = z.infer<typeof beTierSchema>;

/**
 * BE `CustomerPriceResponse`. Không có id, tên sản phẩm, tiền tệ, ngày hiệu lực hay loại khách.
 * `customerId` là id mờ (BE thật: UUID). Jackson `non_null` bỏ `note` khi trống.
 */
export const beCustomerPriceSchema = z.object({
  customerId: z.string().min(1),
  sku: z.string().min(1),
  moq: z.number().int().min(L.minQuantityMin),
  tiers: z.array(beTierSchema).min(1),
  note: omittedOrNull(z.string()),
  version: z.number().int().min(0),
});
export type CustomerPrice = z.infer<typeof beCustomerPriceSchema>;

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
 * xoá: PUT thay cả ghi chú, thiếu ghi chú là xoá ghi chú cũ (BE `CustomerPrice.replace`).
 */
export const customerPriceValuesSchema = z.object({
  tiers: z
    .array(tierInputSchema)
    .min(1, M.tiersCount)
    .max(L.tiersMax, M.tiersCount)
    // BE `CustomerPrice`: hai bậc không cùng `minQuantity` — báo ở mọi bậc trùng
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
export type CustomerPriceValues = z.input<typeof customerPriceValuesSchema>;
export type ValidCustomerPriceValues = z.output<typeof customerPriceValuesSchema>;

/** BE PUT: `version` bắt buộc (`@PositiveOrZero Long`, thiếu → 400). */
export const customerPriceVersionSchema = z
  .number({ message: M.version })
  .int(M.version)
  .min(0, M.version);
