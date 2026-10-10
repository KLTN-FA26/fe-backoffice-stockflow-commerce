import { readMockSkuProcurementSettings } from "./mock-fixtures";

import type { SkuProcurementSettingsView } from "./view-model";

function copy(settings: SkuProcurementSettingsView): SkuProcurementSettingsView {
  // Copy only Procurement-owned fields; extra caller state must never enter this store.
  return {
    skuId: settings.skuId,
    defaultSupplierId: settings.defaultSupplierId,
    defaultSupplierName: settings.defaultSupplierName,
    suppliers: settings.suppliers.map((supplier) => ({ ...supplier })),
  };
}

/** In-memory demo persistence, reset on reload. beforeSave allows deterministic failure/pending tests. */
export function createProcurementMockService(beforeSave: () => Promise<void> = async () => {}) {
  const saved = new Map<string, SkuProcurementSettingsView>();
  return {
    read(skuId: string) {
      return copy(saved.get(skuId) ?? readMockSkuProcurementSettings(skuId));
    },
    async save(settings: SkuProcurementSettingsView) {
      const snapshot = copy(settings);
      await beforeSave();
      saved.set(snapshot.skuId, snapshot);
      return copy(snapshot);
    },
  };
}

export const procurementMockService = createProcurementMockService();
