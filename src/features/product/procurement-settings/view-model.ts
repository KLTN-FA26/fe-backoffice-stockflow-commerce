/** FE display model only. No backend DTO or validation semantics are implied. */
export interface ProcurementSupplierView {
  supplierId: string;
  supplierName: string;
  supplierItemCode: string | null;
  leadTimeDays: number | null;
  moq: number | null;
  orderMultiple: number | null;
}

export interface SkuProcurementSettingsView {
  skuId: string;
  defaultSupplierId: string | null;
  reorderPoint: number | null;
  suppliers: readonly ProcurementSupplierView[];
}
