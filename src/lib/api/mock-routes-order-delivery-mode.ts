/**
 * Mock routes — release đơn + hình thức giao (BE PR #157, LP-1/LP-2), theo hợp đồng BE `OrderReleaseController` và
 * `DeliveryModeController`:
 *
 * - POST /orders/:id/release {warehouseId, deliveryMode?} — đơn CONFIRMED → IN_PRODUCTION (có dòng in) hoặc
 *   READY_TO_FULFILL. Hình thức khác của đơn cần `sales-order-delivery-modes:UPDATE` (403); FTL với đơn thu COD →
 *   409 DELIVERY_MODE_FTL_NO_COD và KHÔNG release gì.
 * - PUT /orders/:id/delivery-mode {deliveryMode, note?≤500} — cần `:UPDATE`; 409 DELIVERY_MODE_LOCKED khi đã khoá,
 *   409 DELIVERY_MODE_FTL_NO_COD; đặt lại đúng hình thức hiện tại thì không ghi lịch sử.
 *
 * "COD" theo luật BE `ck_order_ftl_no_cod`: đơn CỌC có cách thu phần còn lại ON_DELIVERY (`isCodDeposit`), KHÔNG phải
 * phương thức thanh toán "COD" của mock-data. Trạng thái nằm chung `lifecycleStore` của `mock-routes-orders`.
 */

import { ORDER_DELIVERY_MODES, ORDER_PERMISSIONS } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { fail, ok } from "./mock-route-utils";
import {
  backendStatus,
  hasPrintLines,
  isCodDeposit,
  isDeliveryModeLocked,
  seedLifecycle,
  setMockOrderStatus,
  toOrderResponse,
} from "./mock-routes-orders";
import { parseJsonBody, readRouteId, readString } from "./mock-routes-purchase-orders-store";
import { mockGrantsOf } from "./mock-user-grants";

import type { Order } from "@/lib/mock-data";
import type { MockDeliveryMode } from "./mock-routes-orders";

const NOTE_MAX = 500;

const notFound = () => fail(404, "NOT_FOUND", "Resource not found");
const invalid = (field: string, message: string) =>
  fail(400, "VALIDATION_FAILED", "Invalid request data", [{ field, message }]);

function readMode(value: unknown): MockDeliveryMode | null {
  return (ORDER_DELIVERY_MODES as readonly unknown[]).includes(value)
    ? (value as MockDeliveryMode)
    : null;
}

/** Mã quyền của người dùng demo đang đăng nhập (cùng nguồn với `/identity/me/permissions`). */
async function canChangeMode(): Promise<boolean> {
  const { useAuthStore } = await import("@/lib/auth/auth-store");
  return mockGrantsOf(useAuthStore.getState().user?.userId ?? "").has(
    ORDER_PERMISSIONS.deliveryModes,
  );
}

/** LP-2: giao nguyên xe không đi cùng thu tiền khi giao. */
const ftlCollidesWithCod = (order: Order, mode: MockDeliveryMode) =>
  mode === "FULL_TRUCKLOAD" && isCodDeposit(order);

const ftlNoCod = (order: Order) =>
  fail(
    409,
    "DELIVERY_MODE_FTL_NO_COD",
    `Order ${order.orderNumber} is collected on delivery: a full truckload cannot be`,
  );

async function findOrder(id: string): Promise<Order | undefined> {
  const { orders } = await import("@/lib/mock-data");
  return orders.find((o) => o.orderId === id);
}

/** Ghi một lần đổi hình thức (BE `DeliveryModes#apply`): cùng hình thức thì không làm gì, không ghi lịch sử. */
function applyMode(order: Order, mode: MockDeliveryMode, note: string | null): void {
  const state = seedLifecycle(order);
  const previous = state.deliveryMode ?? "PARCEL";
  if (previous === mode) return;
  state.deliveryMode = mode;
  state.deliveryModeChanges.push({
    mode,
    previousMode: previous,
    note,
    changedAt: new Date().toISOString(),
  });
}

export function registerDeliveryModeMockRoutes(): void {
  registerMockRoute("POST", "/orders/:id/release", async (config) => {
    const order = await findOrder(readRouteId(config));
    if (!order) return notFound();
    const body = parseJsonBody(config.data);
    const warehouseId = readString(body.warehouseId);
    if (!warehouseId) return invalid("warehouseId", "warehouseId is required");
    const mode = body.deliveryMode === undefined ? null : readMode(body.deliveryMode);
    if (body.deliveryMode !== undefined && mode === null)
      return invalid("deliveryMode", "deliveryMode is not allowed");

    const state = seedLifecycle(order);
    const current = state.deliveryMode ?? "PARCEL";
    // BE: quyền tra dưới khoá của đơn, chỉ khi hình thức KHÁC hình thức của đơn
    if (mode !== null && mode !== current && !(await canChangeMode()))
      return fail(403, "FORBIDDEN", "Access denied");
    const { warehouses } = await import("@/lib/mock-data");
    if (!warehouses.some((w) => w.warehouseId === warehouseId))
      return fail(404, "WAREHOUSE_NOT_FOUND", `No warehouse ${warehouseId}`);
    if (backendStatus(order) !== "CONFIRMED")
      return fail(409, "CONFLICT", `Order ${order.orderNumber} is not in a releasable status`);
    // LP-2: từ chối thì không release gì cả
    if (ftlCollidesWithCod(order, mode ?? current)) return ftlNoCod(order);

    setMockOrderStatus(order.orderId, hasPrintLines(order) ? "IN_PRODUCTION" : "READY_TO_FULFILL");
    state.warehouseId = warehouseId;
    if (mode !== null) applyMode(order, mode, null);
    return ok(toOrderResponse(order));
  });

  registerMockRoute("PUT", "/orders/:id/delivery-mode", async (config) => {
    const order = await findOrder(readRouteId(config));
    if (!order) return notFound();
    const body = parseJsonBody(config.data);
    const mode = readMode(body.deliveryMode);
    if (mode === null) return invalid("deliveryMode", "deliveryMode is required");
    const note = readString(body.note);
    if (note.length > NOTE_MAX) return invalid("note", "note is at most 500 characters");
    if (!(await canChangeMode())) return fail(403, "FORBIDDEN", "Access denied");

    const state = seedLifecycle(order);
    if (isDeliveryModeLocked(backendStatus(order), state))
      return fail(
        409,
        "DELIVERY_MODE_LOCKED",
        `Order ${order.orderNumber}: the delivery mode can no longer be changed`,
      );
    if (ftlCollidesWithCod(order, mode)) return ftlNoCod(order);
    applyMode(order, mode, note || null);
    return ok(toOrderResponse(order));
  });
}
