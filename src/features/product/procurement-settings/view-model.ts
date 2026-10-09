/** FE display model only. No backend DTO or validation semantics are implied. */
export interface ProcurementSupplierView {
  supplierId: string;
  supplierName: string;
  supplierItemCode: string | null;
  /** Item-level value only; Supplier lead-time fallback is not defined by current BE Java. */
  leadTimeDays: number | null;
  moq: number | null;
  /** Story display field only. Neither BE pack_size column is a confirmed source for this value. */
  orderMultiple: number | null;
}

export interface SkuProcurementSettingsView {
  skuId: string;
  /** Independent inventory-item reference; not derived from supplier_items.is_preferred. */
  defaultSupplierId: string | null;
  /** Display lookup for that reference, independent of membership in suppliers. */
  defaultSupplierName: string | null;
  reorderPoint: number | null;
  suppliers: readonly ProcurementSupplierView[];
}
