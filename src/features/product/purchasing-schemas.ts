/**
 * Thông tin mua hàng của một SKU (docs 01 §3 "Thông tin mua hàng") — BE `SkuPurchasingController`:
 *   GET/PUT /products/{productId}/variants/{variantId}/purchasing   (`variantId` của biến thể, KHÔNG phải mã SKU)
 * Id là chuỗi mờ (opaque) như `beVariantSchema`: BE thật cấp UUID và tự kiểm (400), mock dùng id kiểu
 * `PRD-001` / `SKU-001-BLK-L` / `SUP-001` — FE không chặt hơn hợp đồng chung của các id này.
 * Dữ liệu nằm trên hồ sơ hàng tồn của SKU: `version` là của hồ sơ hàng tồn, dùng chung với logistics,
 * chính sách tồn và "NCC ưu tiên" của danh mục NCC (BE `ItemPurchasingService`). PUT thay TOÀN BỘ —
 * field null là xoá (`SkuPurchasingRequest`). `defaultSupplierId` chính là dòng `preferred` của danh mục NCC.
 *
 * Giá: BE `BigDecimal` tới 9999999999999999.99 nhưng đi qua JSON number, tức số thực IEEE-754 của
 * trình duyệt (`JSON.parse`). FE giữ giá dạng CHUỖI thập phân, không tính toán số thực, và chặn giá mà
 * JSON number không chở nguyên vẹn được thay vì làm tròn ngầm (`travelsExactly`).
 */

import { z } from "zod";

import { SKU_PURCHASING_FIELD_MESSAGES as M, SKU_PURCHASING_LIMITS as L } from "@/constants";
import { canonicalDecimal, DECIMAL_TEXT, travelsExactly } from "@/lib/validation/decimal";
import { omittedOrNull } from "@/lib/validation/primitives";

// BE `ItemPurchasingRules.CURRENCY` / `@Pattern("[A-Z]{3}")`
const CURRENCY = /^[A-Z]{3}$/;

// Giữ đường import cũ của Step 2A (index, test) — định nghĩa dùng chung ở `lib/validation/decimal`
export { canonicalDecimal, travelsExactly };

/** BE `@Positive @Digits(integer = 16, fraction = 2)` + `ItemPurchasingRules` (scale sau khi bỏ 0 cuối). */
function isPurchasePrice(raw: string): boolean {
  if (!DECIMAL_TEXT.test(raw)) return false;
  const canonical = canonicalDecimal(raw);
  const [int = "", frac = ""] = canonical.split(".");
  return (
    canonical !== "0" && int.length <= L.priceIntegerDigitsMax && frac.length <= L.priceMaxScale
  );
}

/* ── DTO (BE → FE) ───────────────────────────────────────────────────── */

/** `BigDecimal` của BE về dạng số JSON (hoặc chuỗi số) → chuỗi thập phân chuẩn, không làm tròn thêm. */
const beDecimalText = z
  .union([z.number().positive(), z.string().regex(DECIMAL_TEXT)])
  .transform((value) => (typeof value === "number" ? String(value) : canonicalDecimal(value)));

/**
 * BE `SkuPurchasingResponse`. Jackson `non_null` bỏ field null khỏi JSON → `omittedOrNull` nhận cả
 * thiếu lẫn null, giữ nguyên số 0 (`leadTimeDays: 0` là "giao ngay", khác "chưa đặt").
 * Đọc nới hơn lúc ghi: không chặt hơn BE với dữ liệu của chính BE.
 */
export const beSkuPurchasingSchema = z.object({
  variantId: z.string().min(1),
  sku: z.string().min(1),
  /** `inventory_items.version` — gửi lại nguyên vẹn khi PUT; lệch → 409 OPTIMISTIC_LOCK. */
  version: z.number().int().min(0),
  defaultSupplierId: omittedOrNull(z.string().min(1)),
  referencePurchasePrice: omittedOrNull(beDecimalText),
  referencePurchaseCurrency: omittedOrNull(z.string().min(1)),
  leadTimeDays: omittedOrNull(z.number().int().min(0)),
  moq: omittedOrNull(z.number().int().min(L.moqMin)),
});
export type SkuPurchasing = z.infer<typeof beSkuPurchasingSchema>;

/* ── Input (FE → BE) ─────────────────────────────────────────────────── */

/** BE `@NotNull @Min(0) Long version`. */
export const skuPurchasingVersionSchema = z
  .number({ message: M.version })
  .int(M.version)
  .min(0, M.version);

const purchasePrice = z
  .string()
  .trim()
  .superRefine((raw, ctx) => {
    if (!isPurchasePrice(raw)) ctx.addIssue({ code: "custom", message: M.referencePurchasePrice });
    else if (!travelsExactly(canonicalDecimal(raw)))
      ctx.addIssue({ code: "custom", message: M.referencePurchasePricePrecision });
  })
  .transform(canonicalDecimal);

/**
 * Cấu hình mua hàng thay thế toàn bộ (PUT). Mọi field đều phải CÓ MẶT — `null` để xoá; thiếu field là
 * lỗi, để không có lần lưu nào vô tình xoá giá trị đang có (BE coi null = xoá).
 */
export const skuPurchasingInputSchema = z
  .object({
    // Id NCC (`supplierId`, không phải mã NCC). BE: đổi NCC mặc định thì NCC phải tồn tại và ACTIVE
    // (404 SUPPLIER_NOT_FOUND / 409 SUPPLIER_INACTIVE) — việc đó BE kiểm, FE chỉ chặn id rỗng
    defaultSupplierId: z.string().trim().min(1, M.defaultSupplierId).nullable(),
    referencePurchasePrice: purchasePrice.nullable(),
    referencePurchaseCurrency: z.string().regex(CURRENCY, M.referencePurchaseCurrency).nullable(),
    leadTimeDays: z
      .number({ message: M.leadTimeDays })
      .int(M.leadTimeDays)
      .min(0, M.leadTimeDays)
      .max(L.leadTimeDaysMax, M.leadTimeDays)
      .nullable(),
    moq: z
      .number({ message: M.moq })
      .int(M.moq)
      .min(L.moqMin, M.moq)
      .max(L.intMax, M.moq)
      .nullable(),
  })
  // BE `ItemPurchasingRules`: giá và tiền tệ cùng có hoặc cùng trống; lỗi đặt ở ô còn thiếu
  .superRefine((values, ctx) => {
    const hasPrice = values.referencePurchasePrice !== null;
    if (hasPrice === (values.referencePurchaseCurrency !== null)) return;
    ctx.addIssue({
      code: "custom",
      path: [hasPrice ? "referencePurchaseCurrency" : "referencePurchasePrice"],
      message: M.pricePairing,
    });
  });
/** Giá trị người gọi đưa vào (giá là chuỗi thập phân). */
export type SkuPurchasingValues = z.input<typeof skuPurchasingInputSchema>;
/** Sau khi parse: giá ở dạng chuỗi chuẩn và chắc chắn đi qua JSON number nguyên vẹn. */
export type ValidSkuPurchasingValues = z.output<typeof skuPurchasingInputSchema>;

/** Cấu hình hiện tại → bộ giá trị đầy đủ để sửa một phần mà vẫn gửi lại mọi field còn lại. */
export function purchasingValuesOf(current: SkuPurchasing): SkuPurchasingValues {
  return {
    defaultSupplierId: current.defaultSupplierId,
    referencePurchasePrice: current.referencePurchasePrice,
    referencePurchaseCurrency: current.referencePurchaseCurrency,
    leadTimeDays: current.leadTimeDays,
    moq: current.moq,
  };
}
