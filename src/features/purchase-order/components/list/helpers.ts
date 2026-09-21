import { DEFAULT_VISIBLE_COLUMNS, type PurchaseOrdersPageConfig } from "./config";

import type { PurchaseOrder, Supplier, Warehouse } from "@/features/purchase-order";

export function supplierName(po: PurchaseOrder, suppliers: readonly Supplier[]): string {
  return suppliers.find((s) => s.supplierId === po.supplierId)?.name ?? "";
}

export function warehouseName(po: PurchaseOrder, warehouses: readonly Warehouse[]): string {
  return warehouses.find((w) => w.warehouseId === po.warehouseId)?.name ?? "";
}

export function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function mergeStoredConfig(
  stored: Partial<PurchaseOrdersPageConfig>,
  fallback: PurchaseOrdersPageConfig,
): PurchaseOrdersPageConfig {
  return {
    ...fallback,
    ...stored,
    globalSearch: { ...fallback.globalSearch, ...stored.globalSearch },
    columnSearch: stored.columnSearch ?? {},
    visibleColumns: stored.visibleColumns?.length ? stored.visibleColumns : DEFAULT_VISIBLE_COLUMNS,
  };
}
