"use client";

import { useMemo } from "react";

import type { PurchaseOrder, Supplier, Warehouse } from "@/features/purchase-order";

import { normalize, supplierName, warehouseName } from "./helpers";
import type { PurchaseOrdersPageConfig } from "./config";

export function usePoFiltered(
  purchaseOrders: readonly PurchaseOrder[],
  pageConfig: PurchaseOrdersPageConfig,
  searchFields: readonly { value: string; getValue: (po: PurchaseOrder) => string }[],
  suppliers: readonly Supplier[],
  warehouses: readonly Warehouse[],
): readonly PurchaseOrder[] {
  return useMemo(() => {
    let list: readonly PurchaseOrder[] = purchaseOrders;
    if (!pageConfig.statuses.includes("all"))
      list = list.filter((po) => (pageConfig.statuses as string[]).includes(po.status));
    const q = normalize(pageConfig.globalSearch.query);
    if (q && pageConfig.globalSearch.fields.length > 0) {
      const fieldMap = new Map(searchFields.map((f) => [f.value, f.getValue]));
      list = list.filter((po) =>
        pageConfig.globalSearch.fields.some((field) =>
          normalize(fieldMap.get(field as string)?.(po) ?? "").includes(q),
        ),
      );
    }
    const poQ = normalize(pageConfig.columnSearch.poNumber ?? "");
    if (poQ) list = list.filter((po) => normalize(po.poNumber).includes(poQ));
    const supQ = normalize(pageConfig.columnSearch.supplier ?? "");
    if (supQ) list = list.filter((po) => normalize(supplierName(po, suppliers)).includes(supQ));
    const whQ = normalize(pageConfig.columnSearch.warehouse ?? "");
    if (whQ) list = list.filter((po) => normalize(warehouseName(po, warehouses)).includes(whQ));
    return list;
  }, [pageConfig, purchaseOrders, searchFields, suppliers, warehouses]);
}
