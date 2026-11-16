/**
 * Mock routes — release đơn, theo hợp đồng BE `OrderReleaseController` (docs 17 §4.2 bước 5, §4.5, BR-03, BR-29).
 * Lịch giao (`GET /orders/:id/delivery-batches`) + dời cửa sổ giao: `mock-routes-order-schedule.ts`.
 *
 * - POST /orders/:id/release {warehouseId, deliveryBatchId?} — cần `sales-order-releases:UPDATE` (403 nếu thiếu; seed BE:
 *   quản lý kho của kho xuất). Đơn CONFIRMED → READY_TO_FULFILL (không còn IN_PRODUCTION, không còn hình thức giao);
 *   `deliveryBatchId` của đơn nhưng không phải đợt kế tiếp → 409 DELIVERY_BATCH_NOT_NEXT, đợt lạ → 404 DELIVERY_BATCH_NOT_FOUND.
 *
 * Trạng thái nằm chung `lifecycleStore` của `mock-routes-orders`. Chỉ dùng khi USE_MOCK=true.
 */

import { ORDER_PERMISSIONS } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { batchesOf, mockBatchIdOf } from "./mock-order-delivery-schedule";
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

export { mockBatchIdOf };

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
    // BR-29: chỉ đợt kế tiếp (đơn chưa release → đợt 1); đợt của đơn nhưng chưa tới lượt → 409, đợt lạ → 404
    if (batchId && !batchesOf(order).some((batch) => batch.batchId === batchId))
      return fail(404, "DELIVERY_BATCH_NOT_FOUND", "Delivery batch not found on this order");
    if (batchId && batchId !== mockBatchIdOf(order))
      return fail(
        409,
        "DELIVERY_BATCH_NOT_NEXT",
        "This is not the order's next delivery batch to release",
      );

    setMockOrderStatus(order.orderId, "READY_TO_FULFILL");
    seedLifecycle(order).warehouseId = warehouseId;
    return ok(toOrderResponse(order));
  });
}
