import { createInventoryFixture } from "./fixtures";

import type { InventoryService } from "./service";

/** Local mock adapter: deterministic, no HTTP fallback or shared random error injection. */
export function createInventoryMockService(): InventoryService {
  return {
    cacheKey: "mock-preview",
    async loadPreview(signal) {
      signal?.throwIfAborted();
      return createInventoryFixture();
    },
    async loadStockItems(sku, warehouseCode, signal) {
      signal?.throwIfAborted();
      return createInventoryFixture().stockItems.filter(
        (item) => item.sku === sku && item.warehouse.code === warehouseCode,
      );
    },
    async lookupAtp(input, signal) {
      signal?.throwIfAborted();
      const row = createInventoryFixture().stockLevels.find(
        (item) => item.sku === input.sku && item.warehouse.code === input.warehouseCode,
      );
      return row ? { sku: row.sku, warehouseCode: row.warehouse.code, quantity: row.atp } : null;
    },
  };
}
