import type { SkuProcurementSettingsView } from "./view-model";

const MAPPED_SKU_ID = "SKU-001-BLK-L";
const DEFAULT_SUPPLIER_EXAMPLE = {
  supplierId: "SUP-001",
  supplierName: "Công ty TNHH Dệt may Thành Công",
};

/**
 * UI-only examples using supplier/SKU records already present in mock-data.ts.
 * Their association and default choice are illustrative, not preferred-supplier semantics.
 * Item terms stay unknown; no supplier-master lead time or pack_size is substituted.
 */
const SUPPLIER_EXAMPLES: Record<string, SkuProcurementSettingsView["suppliers"]> = {
  [MAPPED_SKU_ID]: [
    {
      ...DEFAULT_SUPPLIER_EXAMPLE,
      supplierItemCode: null,
      leadTimeDays: null,
      moq: null,
      orderMultiple: null,
    },
    {
      supplierId: "SUP-004",
      supplierName: "Công ty TNHH May mặc Việt Thắng",
      supplierItemCode: null,
      leadTimeDays: null,
      moq: null,
      orderMultiple: null,
    },
  ],
};

export function readMockSkuProcurementSettings(
  skuId: string,
  reorderPoint: number,
): SkuProcurementSettingsView {
  return {
    skuId,
    defaultSupplierId: skuId === MAPPED_SKU_ID ? DEFAULT_SUPPLIER_EXAMPLE.supplierId : null,
    defaultSupplierName: skuId === MAPPED_SKU_ID ? DEFAULT_SUPPLIER_EXAMPLE.supplierName : null,
    reorderPoint,
    suppliers: SUPPLIER_EXAMPLES[skuId] ?? [],
  };
}
