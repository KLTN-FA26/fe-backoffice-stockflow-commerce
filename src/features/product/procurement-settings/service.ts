import { readMockSkuProcurementSettings } from "./mock-fixtures";

import type { SkuProcurementSettingsView } from "./view-model";

/**
 * FE read composition only, not an atomic write aggregate. BE develop c716da2 has no
 * inventory-item/supplier-item Java or HTTP contracts; their tables have separate owners.
 */
export function readSkuProcurementSettingsView(
  skuId: string,
  reorderPoint: number,
  isMock: boolean,
): SkuProcurementSettingsView {
  if (isMock) return readMockSkuProcurementSettings(skuId, reorderPoint);
  // The legacy SKU value is usable for mock display only, not a BE inventory-item read contract.
  return {
    skuId,
    defaultSupplierId: null,
    defaultSupplierName: null,
    reorderPoint: null,
    suppliers: [],
  };
}
