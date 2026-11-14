/**
 * Mock routes — release đơn + lịch giao, theo hợp đồng BE `OrderReleaseController` và `DeliveryBatchController`
 * (docs 17 §4.2 bước 5, §4.5, BR-03, BR-29):
 *
 * - POST /orders/:id/release {warehouseId, deliveryBatchId?} — cần `sales-order-releases:UPDATE` (403 nếu thiếu; seed BE:
 *   quản lý kho của kho xuất). Đơn CONFIRMED → READY_TO_FULFILL (không còn IN_PRODUCTION, không còn hình thức giao);
 *   `deliveryBatchId` không phải đợt kế tiếp của đơn → 409 DELIVERY_BATCH_NOT_NEXT, đợt lạ → 404 DELIVERY_BATCH_NOT_FOUND.
 * - GET /orders/:id/delivery-batches — cần `sales-contracts:READ` (seed BE: Sales, Kế toán, quản trị — KHÔNG có quản lý
 *   kho). ASSUMPTION (mock-only): mock-data không có hợp đồng, nên mỗi đơn có đúng MỘT đợt giao gồm mọi dòng, đã giữ đủ.
 *
 * Trạng thái nằm chung `lifecycleStore` của `mock-routes-orders`. Chỉ dùng khi USE_MOCK=true.
 */

import { ORDER_PERMISSIONS, SALES_CONTRACT_PERMISSIONS } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { fail, ok } from "./mock-route-utils";
import {
  backendStatus,
  seedLifecycle,
  setMockOrderStatus,
  toOrderResponse,
} from "./mock-routes-orders";
import { parseJsonBody, readRouteId, readString } from "./mock-routes-purchase-orders-store";
import { mockGrantsOf } from "./mock-user-grants";

import type { PermissionCode } from "@/lib/auth";
import type { Order } from "@/lib/mock-data";

const notFound = () => fail(404, "NOT_FOUND", "Resource not found");
const invalid = (field: string, message: string) =>
  fail(400, "VALIDATION_FAILED", "Invalid request data", [{ field, message }]);

/** Id đợt giao mock: ổn định theo đơn (một đợt mỗi đơn). */
export const mockBatchIdOf = (order: Order) => `BATCH-${order.orderId}-1`;

/** Người dùng demo đang đăng nhập có mã quyền này không (cùng nguồn với `/identity/me/permissions`). */
async function hasPermission(code: PermissionCode): Promise<boolean> {
  const { useAuthStore } = await import("@/lib/auth/auth-store");
  return mockGrantsOf(useAuthStore.getState().user?.userId ?? "").has(code);
}

async function findOrder(id: string): Promise<Order | undefined> {
  const { orders } = await import("@/lib/mock-data");
  return orders.find((o) => o.orderId === id);
}

export function registerOrderReleaseMockRoutes(): void {
  registerMockRoute("POST", "/orders/:id/release", async (config) => {
    // BE: `@RequiresPermission(sales-order-releases:UPDATE)` chạy trước mọi kiểm tra khác
    if (!(await hasPermission(ORDER_PERMISSIONS.release)))
      return fail(403, "FORBIDDEN", "Access denied");
    const order = await findOrder(readRouteId(config));
    if (!order) return notFound();
    const body = parseJsonBody(config.data);
    const warehouseId = readString(body.warehouseId);
    if (!warehouseId) return invalid("warehouseId", "warehouseId is required");
    const batchId = readString(body.deliveryBatchId);

    const { warehouses } = await import("@/lib/mock-data");
    if (!warehouses.some((w) => w.warehouseId === warehouseId))
      return fail(404, "WAREHOUSE_NOT_FOUND", `No warehouse ${warehouseId}`);
    if (backendStatus(order) !== "CONFIRMED")
      return fail(
        409,
        "ORDER_INVALID_TRANSITION",
        `Order ${order.orderNumber}: only a confirmed order can be released`,
      );
    // BR-29: chỉ đợt kế tiếp — mock chỉ có một đợt, nên mọi mã khác là "không phải đợt của đơn"
    if (batchId && batchId !== mockBatchIdOf(order))
      return fail(404, "DELIVERY_BATCH_NOT_FOUND", "Delivery batch not found on this order");

    setMockOrderStatus(order.orderId, "READY_TO_FULFILL");
    seedLifecycle(order).warehouseId = warehouseId;
    return ok(toOrderResponse(order));
  });

  registerMockRoute("GET", "/orders/:id/delivery-batches", async (config) => {
    if (!(await hasPermission(SALES_CONTRACT_PERMISSIONS.read)))
      return fail(403, "FORBIDDEN", "Access denied");
    const order = await findOrder(readRouteId(config));
    if (!order) return notFound();
    const released = backendStatus(order) !== "CONFIRMED";
    return ok({
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      batches: [
        {
          batchId: mockBatchIdOf(order),
          seq: 1,
          state: released ? "IN_DELIVERY" : "READY",
          late: false,
          ...(released ? { releasedAt: order.confirmedAt ?? order.placedAt } : {}),
          lines: order.lines.map((line) => ({
            orderLineId: line.lineId,
            sku: line.skuId,
            cartons: line.quantity,
            heldCartons: line.quantity,
          })),
        },
      ],
    });
  });
}
