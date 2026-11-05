/** Fixture test — đúng hình `SupplierItemResponse` BE (SupplierItemController, BE #117/#121). */

import { apiSupplier } from "./supplier";

export const apiSupplierItem = {
  supplierItemId: "si-0001",
  supplierId: apiSupplier.supplierId,
  inventoryItemId: "inv-0001",
  sku: "TEE-WHT-M",
  supplierSkuCode: "TC-TEE-01",
  // BE `BigDecimal` về dạng chuỗi số
  price: "85000",
  currency: "VND",
  moq: 50,
  packSize: 10,
  leadTimeDays: null,
  effectiveLeadTimeDays: 7,
  preferred: true,
  version: 4,
  createdAt: "2026-10-01T00:00:00Z",
  lastModifiedAt: "2026-10-02T00:00:00Z",
};

export const apiSupplierItemOther = {
  ...apiSupplierItem,
  supplierItemId: "si-0002",
  inventoryItemId: "inv-0002",
  sku: "TEE-BLK-L",
  supplierSkuCode: null,
  price: "90000",
  leadTimeDays: 10,
  effectiveLeadTimeDays: 10,
  preferred: false,
  version: 1,
};

export function apiItemPage(items: unknown[] = [apiSupplierItem, apiSupplierItemOther]) {
  return {
    items,
    page: 0,
    size: 15,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
    hasNext: false,
    hasPrevious: false,
  };
}
