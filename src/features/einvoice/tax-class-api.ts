/**
 * Nhóm thuế của sản phẩm (BE `ProductTaxClassController`, demo D-8; QĐ Q-21, HĐ-7 bước 2): Kế toán gặp sản phẩm chưa có
 * nhóm thuế trên nháp hoá đơn (`TAX_CLASS_UNKNOWN`) và gán ngay tại đó. Quyền `product-tax-class:UPDATE` (Kế toán,
 * Trưởng KD) cho cả đọc lẫn sửa. Đổi nhóm chỉ áp dụng cho báo giá / nháp lập SAU khi đổi.
 */

import { z } from "zod";

import { api } from "@/lib/api/client";

export const TAX_CLASSES = ["STANDARD", "REDUCED", "EXEMPT"] as const;
export type TaxClass = (typeof TAX_CLASSES)[number];

const productTaxClassSchema = z.object({
  sku: z.string().nullish(),
  productId: z.string(),
  productCode: z.string(),
  productName: z.string(),
  status: z.string(),
  /** null = chưa từng gán (hoá đơn tính mức cao nhất 10%, không tự phát hành). */
  taxClass: z.enum(TAX_CLASSES).nullish(),
  version: z.number(),
});

export type ProductTaxClass = z.infer<typeof productTaxClassSchema>;

/**
 * Sản phẩm của từng SKU trên hoá đơn. BE nhận `sku` dạng danh sách cách nhau bởi dấu phẩy (Spring tách) — mã SKU không
 * chứa dấu phẩy (`ck_products_code`).
 */
export async function listProductTaxClasses(skus: string[]): Promise<ProductTaxClass[]> {
  const { data } = await api.get<unknown>("/products/tax-classes", {
    params: { sku: skus.join(",") },
  });
  return z.array(productTaxClassSchema).parse(data);
}

export interface ChangeTaxClassInput {
  productId: string;
  taxClass: TaxClass;
  reason: string;
  version: number;
}

export async function changeProductTaxClass(input: ChangeTaxClassInput): Promise<ProductTaxClass> {
  const { productId, ...body } = input;
  const { data } = await api.put<unknown>(
    `/products/${encodeURIComponent(productId)}/tax-class`,
    body,
  );
  return productTaxClassSchema.parse(data);
}
