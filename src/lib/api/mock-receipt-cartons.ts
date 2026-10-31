/**
 * Thùng có LPN trên phiếu nhận mock (BE SCRUM-473 #197), chỉ dùng khi USE_MOCK=true.
 *
 * Mock không có sổ thùng riêng: thùng sống trên dòng phiếu (`MockReceiptLine.packages`), kể cả thùng VOID — BE giữ
 * VOID trong `inventory.stock_package` nhưng không trả trong `GoodsReceiptResponse`, nên `cartonLineView` lọc bỏ.
 */

import type { MockReceiptLine } from "./mock-routes-goods-receipts-store";

export type MockStockPackageStatus = "RECEIVING" | "IN_STOCK" | "CONSUMED" | "LOST" | "VOID";

/** BE `GoodsReceiptResponse.Package` + trạng thái VOID chỉ mock giữ lại. */
export interface MockReceiptPackage {
  id: string;
  lpn: string;
  quantity: number;
  receivedQty: number;
  nominalQty: number;
  status: MockStockPackageStatus;
  locationCode: string | null;
}

/** BE `GoodsReceiptResponse.Unit`. */
export interface MockReceiptUnit {
  unitOfMeasure: string;
  factor: number;
  base: boolean;
  active: boolean;
  defaultPurchase: boolean;
}

/**
 * ASSUMPTION (mock): mock-data không có bảng quy đổi đơn vị (`uom_conversions`). Mỗi SKU có đơn vị cơ sở `PCS` và
 * một đơn vị đóng gói `CARTON` = 10, là đơn vị mua mặc định — đủ để demo chia thùng với SL seed (6–10).
 */
export const MOCK_CARTON_FACTOR = 10;

export function mockUnitsOf(sku: string | null): MockReceiptUnit[] {
  if (!sku) return [];
  return [
    { unitOfMeasure: "PCS", factor: 1, base: true, active: true, defaultPurchase: false },
    {
      unitOfMeasure: "CARTON",
      factor: MOCK_CARTON_FACTOR,
      base: false,
      active: true,
      defaultPurchase: true,
    },
  ];
}

/** Thùng BE còn trả về (mọi trạng thái trừ VOID). */
export function shownPackages(line: Pick<MockReceiptLine, "packages">): MockReceiptPackage[] {
  return (line.packages ?? []).filter((p) => p.status !== "VOID");
}

/** Các field thùng của `GoodsReceiptResponse.Line`, như BE `view()`: phần lẻ = SL dòng − Σ `receivedQty`. */
export function cartonLineView(line: MockReceiptLine) {
  const packages = shownPackages(line);
  return {
    unitOfMeasure: line.unitOfMeasure ?? null,
    looseQuantity: line.quantity - packages.reduce((sum, p) => sum + p.receivedQty, 0),
    packages,
    units: mockUnitsOf(line.sku),
    orderedUnitOfMeasure: null,
  };
}
