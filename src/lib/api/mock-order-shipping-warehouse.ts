/**
 * Kho mock "kho xuất của đơn" (BE `ShippingWarehouseService`, docs 17 §4.2 bước 2-3, BR-21, BR-22, BR-25): kho Sale đã chọn
 * và số thùng đã giữ từng dòng. Chỉ trạng thái + số liệu giả lập — route ở `mock-routes-order-shipping-warehouse.ts`. Chỉ
 * dùng khi USE_MOCK=true.
 *
 * ASSUMPTION (mock-only; mock-data đếm theo cái, không có thùng / tồn từng kho): 1 thùng = 100 cái; kho thứ i (theo mã kho)
 * có sẵn đủ thùng nếu i = 0, một nửa nếu i = 1, không có gì từ i = 2 — để demo đủ ba kết quả giữ hàng (đủ / một phần / chưa
 * có) và cảnh báo sức chứa.
 */

import type { Order, Warehouse } from "@/lib/mock-data";

const UNITS_PER_CARTON = 100;

export interface MockShippingLine {
  lineId: string;
  sku: string;
  cartons: number;
}

interface MockShippingState {
  warehouseId: string;
  /** Thùng đã giữ theo dòng. */
  held: Map<string, number>;
}

const states = new Map<string, MockShippingState>();

export function resetShippingWarehouseMockStore(): void {
  states.clear();
}

export const chosenShippingOf = (orderId: string): MockShippingState | undefined =>
  states.get(orderId);

export function shippingLinesOf(order: Order): MockShippingLine[] {
  return order.lines.map((line) => ({
    lineId: line.lineId,
    sku: line.skuId,
    cartons: Math.max(1, Math.ceil(line.quantity / UNITS_PER_CARTON)),
  }));
}

/** Số thùng có sẵn ở kho thứ `rank` (0 = kho đầu theo mã) cho một dòng cần `cartons` thùng. */
export function availableCartonsAt(rank: number, cartons: number): number {
  if (rank === 0) return cartons;
  return rank === 1 ? Math.floor(cartons / 2) : 0;
}

/** Kho đang hoạt động, theo mã kho — thứ tự này cũng là thứ tự gợi ý của mock. */
export function activeWarehousesByCode(warehouses: readonly Warehouse[]): Warehouse[] {
  return warehouses.filter((w) => w.active).sort((a, b) => a.code.localeCompare(b.code));
}

/** Sức chứa giả lập (m³): kho càng về sau càng chật; từ kho thứ 3 gần như hết chỗ → có cảnh báo (BR-25, không chặn). */
export function mockCapacity(rank: number, lackingCartons: number) {
  const projectedFreeM3 = rank >= 2 ? 0.5 : 100 - 20 * rank;
  const pendingM3 = 5;
  const freeIfAllApprovedM3 = projectedFreeM3 - pendingM3;
  const neededM3 = Math.round(lackingCartons * 0.05 * 1000) / 1000;
  return {
    projectedFreeM3,
    pendingM3,
    freeIfAllApprovedM3,
    neededM3,
    exceedsProjected: neededM3 > projectedFreeM3,
    exceedsIfAllApproved: neededM3 > freeIfAllApprovedM3,
  };
}

/** Chọn kho và giữ phần có sẵn (BE `ShippingWarehouseService#choose`); trả số thùng đã giữ theo dòng. */
export function chooseMockShippingWarehouse(
  order: Order,
  warehouseId: string,
  rank: number,
): MockShippingState {
  const held = new Map(
    shippingLinesOf(order).map((line) => [
      line.lineId,
      Math.min(line.cartons, availableCartonsAt(rank, line.cartons)),
    ]),
  );
  const state = { warehouseId, held };
  states.set(order.orderId, state);
  return state;
}

export const heldCartonsTotal = (state: MockShippingState | undefined): number =>
  state ? [...state.held.values()].reduce((sum, cartons) => sum + cartons, 0) : 0;
