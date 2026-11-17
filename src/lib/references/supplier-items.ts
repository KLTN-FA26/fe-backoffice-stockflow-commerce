/**
 * Hình dạng dòng danh mục hàng của NCC (BE `SupplierItemResponse`) và query key dùng chung cho
 * màn mua hàng của SKU (`features/product`).
 */

import { z } from "zod";

import { omittedOrNull } from "@/lib/validation/primitives";

export const supplierItemSchema = z.object({
  supplierItemId: z.string().min(1),
  supplierId: z.string().min(1),
  inventoryItemId: z.string().min(1),
  sku: z.string().min(1),
  supplierSkuCode: omittedOrNull(z.string()),
  // BE `BigDecimal` có thể về dạng chuỗi số
  price: z.coerce.number(),
  currency: z.string().min(1),
  moq: z.number().int().min(1),
  packSize: z.number().int().min(1),
  leadTimeDays: omittedOrNull(z.number().int()),
  effectiveLeadTimeDays: z.number().int(),
  preferred: z.boolean(),
  version: z.number().int(),
  createdAt: z.string(),
  // `last_modified_at` NULL tới lần sửa đầu (dòng seed / mới tạo) → BE bỏ khỏi JSON
  lastModifiedAt: omittedOrNull(z.string()),
});

export interface SupplierItemListParams {
  page?: number;
  size?: number;
  sort?: string;
}

export const supplierItemKeys = {
  all: ["references", "supplier-items"] as const,
  lists: (supplierId: string) => [...supplierItemKeys.all, "list", supplierId] as const,
  list: (supplierId: string, params: SupplierItemListParams) =>
    [...supplierItemKeys.lists(supplierId), params] as const,
  catalog: (supplierId: string) => [...supplierItemKeys.all, "catalog", supplierId] as const,
};
