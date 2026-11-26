/**
 * Form tạo / sửa bảng giá khách hàng (lớp Input của form, api-conventions §3.1). Phần chung với giá chuẩn (ô nhập là
 * chuỗi, chỉ chữ số, giá cũ không chính xác, giữ thứ tự bậc) ở `lib/pricing/price-tier-form.ts`; tên ở đây giữ cho các
 * màn và test của bảng giá khách.
 */
import {
  emptyPriceTierForm,
  formToPriceTierValues,
  priceTierFormSchema,
  priceTiersToForm,
  PRICE_SKU,
} from "@/lib/pricing/price-tier-form";

import type { PriceTierFormValues } from "@/lib/pricing/price-tier-form";
import type { CustomerPrice } from "./schemas";

export { emptyTier, normalizeSku, serverFieldToFormPath } from "@/lib/pricing/price-tier-form";
export type { TierFormValue } from "@/lib/pricing/price-tier-form";

/** BE `CustomerPriceService.sku`: strip + in hoa, dạng `ck_variants_sku`. */
export const CUSTOMER_PRICE_SKU = PRICE_SKU;

export type CustomerPriceFormValues = PriceTierFormValues;

export const emptyCustomerPriceForm = emptyPriceTierForm;

/** Bản của BE → ô nhập. Giá không chính xác KHÔNG được đổ vào ô (để trống + cờ `inexact`). */
export const customerPriceToForm = (price: CustomerPrice): CustomerPriceFormValues =>
  priceTiersToForm(price);

export const formToCustomerPriceValues = formToPriceTierValues;

/** SKU (chỉ khi tạo), chữ số của đơn giá, rồi luật bậc giá chung; lỗi giữ đường dẫn `tiers.i.*` / `note`. */
export const customerPriceFormSchema = priceTierFormSchema;
