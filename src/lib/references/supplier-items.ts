/**
 * Danh mục hàng của NCC (`GET /suppliers/{id}/items`) dùng chung cho tab danh mục NCC và
 * bộ chọn SKU của form PO.
 *
 * Đặt ở `lib/` để `features/supplier` và `features/purchase-order` cùng dùng mà không import
 * chéo (feature-architecture). Hình dạng theo BE `SupplierItemResponse`.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { SUPPLIER_ITEM_LIMITS } from "@/constants";
import { api } from "@/lib/api/client";
import { bePageSchema } from "@/lib/api/page-schema";
import { QUERY_TIMES } from "@/lib/api/query-client";
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

export type SupplierItemRef = z.infer<typeof supplierItemSchema>;

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

export interface SupplierCatalog {
  items: SupplierItemRef[];
  /** Tiền tệ của NCC suy từ dòng đầu (BE quy giá về tiền tệ NCC); null khi danh mục rỗng. */
  currency: string | null;
  /** Còn dòng chưa tải về (totalElements > số dòng nhận). */
  truncated: boolean;
}

const catalogPageSchema = bePageSchema(supplierItemSchema);

export async function fetchSupplierCatalog(
  supplierId: string,
  signal?: AbortSignal,
): Promise<SupplierCatalog> {
  const params = new URLSearchParams({
    page: "0",
    size: String(SUPPLIER_ITEM_LIMITS.catalogPageSize),
  });
  const { data } = await api.get<unknown>(`/suppliers/${encodeURIComponent(supplierId)}/items`, {
    params,
    signal,
  });
  const page = catalogPageSchema.parse(data);
  const items = [...page.items].sort((a, b) => a.sku.localeCompare(b.sku));
  return {
    items,
    currency: items[0]?.currency ?? null,
    truncated: page.totalElements > page.items.length,
  };
}

export function useSupplierCatalog(supplierId: string, enabled: boolean) {
  return useQuery({
    queryKey: supplierItemKeys.catalog(supplierId),
    queryFn: ({ signal }) => fetchSupplierCatalog(supplierId, signal),
    enabled: enabled && supplierId !== "",
    ...QUERY_TIMES.master,
  });
}
