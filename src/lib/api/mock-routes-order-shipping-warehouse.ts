/**
 * Mock routes — kho xuất của đơn, theo hợp đồng BE `ShippingWarehouseController` (docs 17 §4.2 bước 2-3, BR-21, BR-22,
 * BR-25). Chỉ dùng khi USE_MOCK=true.
 *
 * - GET /orders/:id/shipping-warehouse/options — `sales-order-shipping-warehouses:READ`: các kho (tốt nhất đầu danh sách) kèm
 *   thùng có sẵn từng dòng và sức chứa; `chosenWarehouseId` vắng khi chưa chọn.
 * - GET /orders/:id/stock-coverage — `sales-order-shipping-warehouses:READ`: đã giữ bao nhiêu thùng theo dòng.
 * - PUT /orders/:id/shipping-warehouse {warehouseId} — `sales-order-shipping-warehouses:UPDATE`. Thứ tự kiểm như BE: quyền →
 *   body → 404 đơn → 404 WAREHOUSE_NOT_FOUND → 409 ORDER_SHIPPING_WAREHOUSE_NOT_ALLOWED (không phải đơn Confirmed) → 409
 *   ORDER_SHIPPING_WAREHOUSE_LOCKED (đã giữ hàng ở kho khác). Chọn xong giữ phần có sẵn và trả tình trạng giữ hàng.
 */

import { ORDER_SHIPPING_WAREHOUSE_PERMISSIONS } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import {
  activeWarehousesByCode,
  availableCartonsAt,
  chooseMockShippingWarehouse,
  chosenShippingOf,
  heldCartonsTotal,
  mockCapacity,
  shippingLinesOf,
} from "./mock-order-shipping-warehouse";
import { bodyOf, fail, ok, pathParams, text } from "./mock-route-utils";
import { hasMockPermission } from "./mock-routes-order-schedule";
import { backendStatus, findOrder } from "./mock-routes-orders-store";

import type { Order } from "@/lib/mock-data";

const forbidden = () => fail(403, "FORBIDDEN", "Access denied");
const notFound = () => fail(404, "NOT_FOUND", "Resource not found");

async function activeWarehouses() {
  const { warehouses } = await import("@/lib/mock-data");
  return activeWarehousesByCode(warehouses);
}

function coverageOf(order: Order, warehouse: { warehouseId: string; code: string } | undefined) {
  const state = chosenShippingOf(order.orderId);
  const lines = shippingLinesOf(order).map((line) => {
    const held = state?.held.get(line.lineId) ?? 0;
    return { ...line, heldCartons: held, shortCartons: line.cartons - held };
  });
  return {
    orderId: order.orderId,
    warehouseId: warehouse?.warehouseId ?? null,
    warehouseCode: warehouse?.code ?? null,
    fullyHeld: lines.every((line) => line.shortCartons === 0),
    lines,
    batches: [],
  };
}

export function registerOrderShippingWarehouseMockRoutes(): void {
  registerMockRoute("GET", "/orders/:id/shipping-warehouse/options", async (config) => {
    if (!(await hasMockPermission(ORDER_SHIPPING_WAREHOUSE_PERMISSIONS.read))) return forbidden();
    const order = await findOrder(pathParams(config).id ?? "");
    if (!order) return notFound();
    const lines = shippingLinesOf(order);
    const chosen = chosenShippingOf(order.orderId);
    const warehouses = (await activeWarehouses()).map((warehouse, rank) => {
      const availability = lines.map((line) => ({
        lineId: line.lineId,
        sku: line.sku,
        cartons: line.cartons,
        availableCartons: availableCartonsAt(rank, line.cartons),
      }));
      const lacking = availability.reduce((sum, a) => sum + (a.cartons - a.availableCartons), 0);
      return {
        warehouseId: warehouse.warehouseId,
        warehouseCode: warehouse.code,
        warehouseName: warehouse.name,
        holdsEveryLine: lacking === 0,
        availableCartons: availability.reduce((sum, a) => sum + a.availableCartons, 0),
        lines: availability,
        ...mockCapacity(rank, lacking),
      };
    });
    return ok({
      orderId: order.orderId,
      chosenWarehouseId: chosen?.warehouseId ?? null,
      capacityComputed: true,
      warehouses,
    });
  });

  registerMockRoute("GET", "/orders/:id/stock-coverage", async (config) => {
    if (!(await hasMockPermission(ORDER_SHIPPING_WAREHOUSE_PERMISSIONS.read))) return forbidden();
    const order = await findOrder(pathParams(config).id ?? "");
    if (!order) return notFound();
    const chosenId = chosenShippingOf(order.orderId)?.warehouseId;
    const warehouse = (await activeWarehouses()).find((w) => w.warehouseId === chosenId);
    return ok(coverageOf(order, warehouse));
  });

  registerMockRoute("PUT", "/orders/:id/shipping-warehouse", async (config) => {
    // BE: `@RequiresPermission(sales-order-shipping-warehouses:UPDATE)` chạy trước mọi kiểm tra khác
    if (!(await hasMockPermission(ORDER_SHIPPING_WAREHOUSE_PERMISSIONS.update))) return forbidden();
    const warehouseId = text(bodyOf(config).warehouseId);
    if (!warehouseId) {
      return fail(400, "VALIDATION_FAILED", "Invalid request data", [
        { field: "warehouseId", message: "warehouseId is required" },
      ]);
    }
    const order = await findOrder(pathParams(config).id ?? "");
    if (!order) return notFound();
    const warehouses = await activeWarehouses();
    const rank = warehouses.findIndex((w) => w.warehouseId === warehouseId);
    if (rank < 0) return fail(404, "WAREHOUSE_NOT_FOUND", `No active warehouse ${warehouseId}`);
    if (backendStatus(order) !== "CONFIRMED") {
      return fail(
        409,
        "ORDER_SHIPPING_WAREHOUSE_NOT_ALLOWED",
        `Order ${order.orderNumber}: the shipping warehouse is chosen for a confirmed order of a contract`,
      );
    }
    const current = chosenShippingOf(order.orderId);
    if (current && current.warehouseId !== warehouseId && heldCartonsTotal(current) > 0) {
      return fail(
        409,
        "ORDER_SHIPPING_WAREHOUSE_LOCKED",
        `Order ${order.orderNumber} holds stock at its shipping warehouse; release those holds before choosing another`,
      );
    }
    chooseMockShippingWarehouse(order, warehouseId, rank);
    return ok(coverageOf(order, warehouses[rank]));
  });
}
