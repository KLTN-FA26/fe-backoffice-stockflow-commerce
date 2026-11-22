/** Fixture đúng hình BE `ShippingWarehouseService.Options` / `Coverage` (sau khi interceptor bóc envelope). */

import { ORDER_PERMISSIONS, ORDER_SHIPPING_WAREHOUSE_PERMISSIONS } from "@/constants";

import { ORDER_PERMISSION_SETS } from "./render";
import { apiOrder } from "./order";

import type { PermissionCode } from "@/lib/auth";

export const LINE_A = apiOrder.lines[0]?.lineId ?? "line-a";
export const LINE_B = "9f0e1d2c-aaaa-4bbb-8ccc-dddd00002222";
export const WH_HCM = "11111111-0000-4000-8000-0000000000a1";
export const WH_HN = "11111111-0000-4000-8000-0000000000b2";
export const OPTIONS_PATH = `/orders/${apiOrder.orderId}/shipping-warehouse/options`;
export const COVERAGE_PATH = `/orders/${apiOrder.orderId}/stock-coverage`;
export const CHOOSE_PATH = `/orders/${apiOrder.orderId}/shipping-warehouse`;

/** Sale (SALES_STAFF) theo seed BE: đọc đơn + chọn kho xuất; quản lý kho: đọc kho xuất, không chọn. */
export const SHIPPING_PERMISSION_SETS = {
  sale: [
    ...ORDER_PERMISSION_SETS.salesStaff,
    ORDER_SHIPPING_WAREHOUSE_PERMISSIONS.read,
    ORDER_SHIPPING_WAREHOUSE_PERMISSIONS.update,
  ],
  warehouseManager: [
    ...ORDER_PERMISSION_SETS.warehouseManager,
    ORDER_SHIPPING_WAREHOUSE_PERMISSIONS.read,
  ],
  noShippingCodes: [ORDER_PERMISSIONS.viewPage, ORDER_PERMISSIONS.read],
} satisfies Record<string, PermissionCode[]>;

export const apiOption = (patch: Record<string, unknown> = {}) => ({
  warehouseId: WH_HCM,
  warehouseCode: "HCM01",
  warehouseName: "Kho TP.HCM",
  holdsEveryLine: true,
  availableCartons: 12,
  lines: [
    { lineId: LINE_A, sku: "CUP-12OZ-ACME", cartons: 8, availableCartons: 8 },
    { lineId: LINE_B, sku: "CUP-16OZ-ACME", cartons: 4, availableCartons: 4 },
  ],
  projectedFreeM3: 120.5,
  pendingM3: 10,
  freeIfAllApprovedM3: 110.5,
  neededM3: 0,
  exceedsProjected: false,
  exceedsIfAllApproved: false,
  ...patch,
});

export const apiOptions = (
  chosenWarehouseId: string | null = null,
  warehouses = defaultWarehouses(),
) => ({
  orderId: apiOrder.orderId,
  ...(chosenWarehouseId ? { chosenWarehouseId } : {}),
  capacityComputed: true,
  warehouses,
});

export function defaultWarehouses() {
  return [
    apiOption(),
    apiOption({
      warehouseId: WH_HN,
      warehouseCode: "HN01",
      warehouseName: "Kho Hà Nội",
      holdsEveryLine: false,
      availableCartons: 5,
      lines: [
        { lineId: LINE_A, sku: "CUP-12OZ-ACME", cartons: 8, availableCartons: 3 },
        { lineId: LINE_B, sku: "CUP-16OZ-ACME", cartons: 4, availableCartons: 2 },
      ],
      projectedFreeM3: 0.5,
      freeIfAllApprovedM3: -4.5,
      neededM3: 1.25,
      exceedsProjected: true,
      exceedsIfAllApproved: true,
    }),
  ];
}

type LineHeld = readonly [held: number, cartons: number];

const SKUS = ["CUP-12OZ-ACME", "CUP-16OZ-ACME"] as const;

function lineCoverage(lineId: string, sku: string, [held, cartons]: LineHeld) {
  return { lineId, sku, cartons, heldCartons: held, shortCartons: cartons - held };
}

/** Tình trạng giữ hàng: `[đã giữ, cần]` theo hai dòng [A, B]; `warehouse` null = chưa chọn kho. */
export function apiCoverage(
  [lineA, lineB]: readonly [LineHeld, LineHeld],
  warehouse: "hcm" | null = "hcm",
) {
  const lines = [lineCoverage(LINE_A, SKUS[0], lineA), lineCoverage(LINE_B, SKUS[1], lineB)];
  return {
    orderId: apiOrder.orderId,
    ...(warehouse ? { warehouseId: WH_HCM, warehouseCode: "HCM01" } : {}),
    fullyHeld: lines.every((line) => line.shortCartons === 0),
    lines,
    batches: [],
  };
}
