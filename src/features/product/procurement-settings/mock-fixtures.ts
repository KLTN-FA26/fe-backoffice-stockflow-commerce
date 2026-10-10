import type { SkuProcurementSettingsView } from "./view-model";

const MAPPED_SKU_ID = "SKU-001-BLK-L";
const DEFAULT_SUPPLIER_EXAMPLE = {
  supplierId: "SUP-001",
  supplierName: "Công ty TNHH Dệt may Thành Công",
};

/** Existing supplier identities only; master purchasing terms are deliberately absent. */
export const PROCUREMENT_SUPPLIER_CHOICES = [
  DEFAULT_SUPPLIER_EXAMPLE,
  { supplierId: "SUP-002", supplierName: "Guangzhou Print Supplies Co., Ltd" },
  { supplierId: "SUP-003", supplierName: "Công ty CP Gốm sứ Minh Long" },
  { supplierId: "SUP-004", supplierName: "Công ty TNHH May mặc Việt Thắng" },
];

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

export function readMockSkuProcurementSettings(skuId: string): SkuProcurementSettingsView {
  return {
    skuId,
    defaultSupplierId: skuId === MAPPED_SKU_ID ? DEFAULT_SUPPLIER_EXAMPLE.supplierId : null,
    defaultSupplierName: skuId === MAPPED_SKU_ID ? DEFAULT_SUPPLIER_EXAMPLE.supplierName : null,
    suppliers: SUPPLIER_EXAMPLES[skuId] ?? [],
  };
}
