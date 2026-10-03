"use client";

import { useMemo } from "react";

import { normalize, supplierLabel } from "./helpers";

import type { SupplierRef } from "@/lib/references/supplier-lookup";
import type { PurchaseOrder } from "@/features/purchase-order";
import type { PurchaseOrdersPageConfig } from "./config";

/**
 * Lọc tìm kiếm trên TRANG ĐÃ TẢI. BE `GET /purchase-orders` không có tham số tìm kiếm tự do
 * (chỉ status / supplierId / sort / page) — trạng thái đã lọc ở server, phần này chỉ lọc chữ.
 */
export function usePoFiltered(
  purchaseOrders: readonly PurchaseOrder[],
  pageConfig: PurchaseOrdersPageConfig,
  searchFields: readonly { value: string; getValue: (po: PurchaseOrder) => string }[],
  supplierRefs: ReadonlyMap<string, SupplierRef>,
): PurchaseOrder[] {
  return useMemo(() => {
    let list = [...purchaseOrders];
    const q = normalize(pageConfig.globalSearch.query);
    if (q && pageConfig.globalSearch.fields.length > 0) {
      const fieldMap = new Map(searchFields.map((f) => [f.value, f.getValue]));
      list = list.filter((po) =>
        pageConfig.globalSearch.fields.some((field) =>
          normalize(fieldMap.get(field)?.(po) ?? "").includes(q),
        ),
      );
    }
    const poQ = normalize(pageConfig.columnSearch.poNumber ?? "");
    if (poQ) list = list.filter((po) => normalize(po.poNumber).includes(poQ));
    const supQ = normalize(pageConfig.columnSearch.supplier ?? "");
    if (supQ) list = list.filter((po) => normalize(supplierLabel(po, supplierRefs)).includes(supQ));
    return list;
  }, [pageConfig, purchaseOrders, searchFields, supplierRefs]);
}
