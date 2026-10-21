/**
 * Supplier item — query danh sách danh mục hàng của một NCC (tab CRUD).
 * Key lấy từ `supplierItemKeys` (lib/references) để mutation và bộ chọn SKU của PO cùng invalidate.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { supplierItemKeys } from "@/lib/references/supplier-items";

import { listSupplierItems } from "./item-api";

import type { SupplierItemListParams } from "@/lib/references/supplier-items";

export function useSupplierItems(
  supplierId: string,
  params: SupplierItemListParams,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: supplierItemKeys.list(supplierId, params),
    queryFn: ({ signal }) => listSupplierItems(supplierId, params, signal),
    enabled: enabled && supplierId !== "",
    placeholderData: keepPreviousData,
    ...QUERY_TIMES.list,
  });
}
