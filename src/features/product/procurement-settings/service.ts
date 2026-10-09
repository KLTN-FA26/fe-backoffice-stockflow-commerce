import { readMockSkuProcurementSettings } from "./mock-fixtures";

import type { SkuProcurementSettingsView } from "./view-model";

/** FE-only source boundary; a future query/adapter can replace this reader. */
export function readSkuProcurementSettingsView(
  skuId: string,
  reorderPoint: number,
  isMock: boolean,
): SkuProcurementSettingsView {
  if (isMock) return readMockSkuProcurementSettings(skuId, reorderPoint);
  return { skuId, defaultSupplierId: null, reorderPoint, suppliers: [] };
}
