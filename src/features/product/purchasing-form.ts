/**
 * Form sửa thông tin mua hàng (lớp Input của form, api-conventions §3.1). Ô nhập là chuỗi người dùng gõ;
 * `formToPurchasingValues` đổi sang `SkuPurchasingValues` (null tường minh cho ô trống) và mọi luật kiểm
 * là của `skuPurchasingInputSchema` (Step 2A, chép từ BE `SkuPurchasingRequest` + `ItemPurchasingRules`)
 * — không có bộ luật thứ hai, chỉ thêm luật an toàn nhập liệu của ô giá (`priceInputIssue`). Giá giữ dạng
 * chuỗi tới lúc `toSkuPurchasingRequest` tuần tự hoá.
 */
import { z } from "zod";

import { SKU_PURCHASING_FIELD_MESSAGES as M, SKU_PURCHASING_LIMITS as L } from "@/constants";

import { skuPurchasingInputSchema } from "./purchasing-schemas";

import type { SkuPurchasing, SkuPurchasingValues } from "./purchasing-schemas";

/** Giá trị của ô chọn khi SKU không có NCC mặc định (Radix Select không nhận chuỗi rỗng). */
export const NO_DEFAULT_SUPPLIER = "__none__";

export interface PurchasingFormValues {
  defaultSupplierId: string;
  referencePurchasePrice: string;
  referencePurchaseCurrency: string;
  leadTimeDays: string;
  moq: string;
}

const DIGITS = /^\d+$/;

/** Ô số nguyên: trống → null; "0" → 0 (không bao giờ thành null); sai dạng → NaN để schema báo lỗi ô. */
function integerOrNull(raw: string): number | null {
  const text = raw.trim();
  if (text === "") return null;
  return DIGITS.test(text) ? Number(text) : Number.NaN;
}

/** Ô giá: trống → null; còn lại giữ NGUYÊN chuỗi đã nhập — không đổi dấu phẩy / dấu chấm (xem `priceInputIssue`). */
function decimalOrNull(raw: string): string | null {
  const text = raw.trim();
  return text === "" ? null : text;
}

// Nhóm 3 chữ số sau dấu chấm / phẩy / khoảng trắng ("150.000", "95,000", "1 500 000"): ở VN đó là dấu
// phân cách hàng nghìn, ở en-US lại là phần thập phân — không đoán, bắt nhập lại
const GROUPED_DIGITS = /^\d{1,3}([.,\s]\d{3})+$/;
const RAW_FRACTION = /\.(\d*)$/;

/**
 * Luật AN TOÀN NHẬP LIỆU của ô giá (chặt hơn BE có chủ đích — BE `@Digits(fraction = 2)` +
 * `stripTrailingZeros` nhận "150.000" là 150): chỉ chữ số, dấu chấm là dấu thập phân duy nhất, tối đa
 * 2 chữ số thập phân NGAY TRÊN CHUỖI GỐC (trước khi bỏ 0 cuối). Ô trống / hợp lệ → null, còn lại do
 * `skuPurchasingInputSchema` kiểm theo BE.
 */
function priceInputIssue(raw: string): string | null {
  const text = raw.trim();
  if (text === "") return null;
  if (GROUPED_DIGITS.test(text))
    return M.referencePurchasePriceGrouped(text.replace(/[.,\s]/g, ""));
  if (text.includes(",")) return M.referencePurchasePriceComma;
  if (/\s/.test(text)) return M.referencePurchasePriceGrouped(text.replace(/\s/g, ""));
  // Hai dấu chấm trở lên ("1.500.000.50") — chắc chắn có dấu phân cách hàng nghìn, không đoán phần nào
  if (text.split(".").length > 2) return M.referencePurchasePriceGrouped(null);
  const fraction = RAW_FRACTION.exec(text)?.[1];
  if (fraction !== undefined && fraction.length > L.priceMaxScale) return M.referencePurchasePrice;
  return null;
}

export function formToPurchasingValues(form: PurchasingFormValues): SkuPurchasingValues {
  const currency = form.referencePurchaseCurrency.trim().toUpperCase();
  return {
    defaultSupplierId:
      form.defaultSupplierId === NO_DEFAULT_SUPPLIER ? null : form.defaultSupplierId,
    referencePurchasePrice: decimalOrNull(form.referencePurchasePrice),
    referencePurchaseCurrency: currency === "" ? null : currency,
    leadTimeDays: integerOrNull(form.leadTimeDays),
    moq: integerOrNull(form.moq),
  };
}

/** Bản của BE → ô nhập; 0 hiện là "0", null là ô trống. */
export function purchasingToForm(purchasing: SkuPurchasing): PurchasingFormValues {
  return {
    defaultSupplierId: purchasing.defaultSupplierId ?? NO_DEFAULT_SUPPLIER,
    referencePurchasePrice: purchasing.referencePurchasePrice ?? "",
    referencePurchaseCurrency: purchasing.referencePurchaseCurrency ?? "",
    leadTimeDays: purchasing.leadTimeDays === null ? "" : String(purchasing.leadTimeDays),
    moq: purchasing.moq === null ? "" : String(purchasing.moq),
  };
}

/** Kiểm form bằng đúng schema Input của Step 2A; lỗi giữ nguyên tên ô (trùng tên field BE). */
export const purchasingFormSchema = z
  .object({
    defaultSupplierId: z.string(),
    referencePurchasePrice: z.string(),
    referencePurchaseCurrency: z.string(),
    leadTimeDays: z.string(),
    moq: z.string(),
  })
  .superRefine((form, ctx) => {
    const priceIssue = priceInputIssue(form.referencePurchasePrice);
    if (priceIssue)
      ctx.addIssue({ code: "custom", path: ["referencePurchasePrice"], message: priceIssue });
    const parsed = skuPurchasingInputSchema.safeParse(formToPurchasingValues(form));
    if (parsed.success) return;
    for (const issue of parsed.error.issues) {
      // Ô giá đã có lỗi nhập liệu cụ thể hơn — không chồng thêm lỗi chung của schema
      if (priceIssue && issue.path[0] === "referencePurchasePrice") continue;
      ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
    }
  });
