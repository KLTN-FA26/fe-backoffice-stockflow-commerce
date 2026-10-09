import { PROCUREMENT_SUPPLIER_CHOICES } from "./mock-fixtures";
import { procurementMockService } from "./mock-service";

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
  if (isMock) return procurementMockService.read(skuId, reorderPoint);
  // The legacy SKU value is usable for mock display only, not a BE inventory-item read contract.
  return {
    skuId,
    defaultSupplierId: null,
    defaultSupplierName: null,
    reorderPoint: null,
    suppliers: [],
  };
}

export function readProcurementSupplierChoices(
  isMock: boolean,
  current?: SkuProcurementSettingsView,
) {
  if (!isMock) return [];
  // Keep existing references selectable even if a future directory lacks the record.
  const choices = new Map(
    PROCUREMENT_SUPPLIER_CHOICES.map((supplier) => [supplier.supplierId, { ...supplier }]),
  );
  for (const supplier of current?.suppliers ?? []) {
    choices.set(supplier.supplierId, {
      supplierId: supplier.supplierId,
      supplierName: supplier.supplierName,
    });
  }
  if (current?.defaultSupplierId) {
    choices.set(current.defaultSupplierId, {
      supplierId: current.defaultSupplierId,
      supplierName:
        current.defaultSupplierName ??
        choices.get(current.defaultSupplierId)?.supplierName ??
        current.defaultSupplierId,
    });
  }
  return [...choices.values()];
}

/**
 * MOCK INTERACTION CONTRACT ONLY: one FE save does not promise an atomic BE write.
 * Inventory and supplier mappings have separate unresolved write boundaries.
 * No preferred/default sync, lead-time fallback, or orderMultiple/pack_size mapping.
 */
export async function saveProcurementSettings(
  settings: SkuProcurementSettingsView,
  isMock: boolean,
): Promise<SkuProcurementSettingsView> {
  if (!isMock) throw new Error("Chờ hợp đồng dữ liệu mua hàng; chỉ lưu dữ liệu minh hoạ.");
  return procurementMockService.save(settings);
}
