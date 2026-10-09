import type { SkuProcurementSettingsView } from "./view-model";

/**
 * UI-only examples using supplier/SKU records already present in mock-data.ts.
 * Their association is illustrative; it is not an inferred supplier-item contract.
 */
const SUPPLIER_EXAMPLES: Record<string, SkuProcurementSettingsView["suppliers"]> = {
  "SKU-001-BLK-L": [
    {
      supplierId: "SUP-001",
      supplierName: "Công ty TNHH Dệt may Thành Công",
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
    defaultSupplierId: skuId === "SKU-001-BLK-L" ? "SUP-001" : null,
    reorderPoint,
    suppliers: SUPPLIER_EXAMPLES[skuId] ?? [],
  };
}
