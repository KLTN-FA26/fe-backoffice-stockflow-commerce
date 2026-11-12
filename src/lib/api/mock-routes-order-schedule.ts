/**
 * Mock routes — lịch giao của đơn + dời cửa sổ giao, theo hợp đồng BE `DeliveryBatchController` /
 * `DeliveryBatchService` (docs 17 §4.5, §5.5, BR-28):
 *
 * - GET  /orders/:id/delivery-batches — `sales-contracts:READ` (seed BE: Sales, Kế toán, quản trị — KHÔNG có quản lý kho).
 *   Mỗi đợt: cửa sổ hợp đồng + cửa sổ hiệu lực, trạng thái hiển thị tính từ lô giao, cờ trễ, thùng theo SKU, lịch sử dời.
 * - POST /orders/:id/delivery-batches/:batchId/window-change — `sales-contracts:UPDATE` (chỉ Sale). Thứ tự kiểm như BE:
 *   quyền → body (bean validation) → 404 đơn → `requireWellFormed` → `check`: đơn đã huỷ / đóng 409 CONFLICT, đợt lạ 404
 *   DELIVERY_BATCH_NOT_FOUND, đợt đã có lô giao 409 DELIVERY_BATCH_WINDOW_LOCKED, bằng chứng không phải tin nhắn khách
 *   400, ngày quá khứ 400, sai thứ tự đợt 400. Bằng chứng tệp (`evidenceUploadId`) chưa mô phỏng — mock-only.
 *
 * Lịch giao suy từ đơn (xem `mock-order-delivery-schedule.ts`). Chỉ dùng khi USE_MOCK=true.
 */

import { SALES_CONTRACT_PERMISSIONS } from "@/constants";
import { toLocalIsoDate } from "@/lib/format/date";

import { registerMockRoute } from "./mock-adapter";
import {
  MOCK_STAFF_MESSAGE_ID,
  batchHasShipment,
  batchStateOf,
  batchesOf,
  recordWindowChange,
  windowChangesOf,
  windowInForce,
} from "./mock-order-delivery-schedule";
import { bodyOf, fail, isUuidText, ok, pathParams, text } from "./mock-route-utils";
import {
  RELEASED_STATUSES,
  backendStatus,
  findOrder,
  holdOf,
  shipmentsOf,
} from "./mock-routes-orders-store";
import { mockGrantsOf } from "./mock-user-grants";

import type { MockBatch } from "./mock-order-delivery-schedule";
import type { MockShipment } from "./mock-routes-orders-store";
import type { PermissionCode } from "@/lib/auth";
import type { Order } from "@/lib/mock-data";

const notFound = () => fail(404, "NOT_FOUND", "Resource not found");
const invalid = (field: string, message: string) =>
  fail(400, "VALIDATION_FAILED", "Invalid request data", [{ field, message }]);

/** Người dùng demo đang đăng nhập có mã quyền này không (cùng nguồn với `/identity/me/permissions`). */
export async function hasMockPermission(code: PermissionCode): Promise<boolean> {
  const { useAuthStore } = await import("@/lib/auth/auth-store");
  return mockGrantsOf(useAuthStore.getState().user?.userId ?? "").has(code);
}

const CLOSED_ORDER = ["CANCELLED", "CLOSED", "COMPLETED"] as const;
const isClosed = (order: Order) => CLOSED_ORDER.some((status) => status === backendStatus(order));

/** Đơn đã release cho kho (kể cả đang bị giữ từ bước đó) — đợt 1 mang `releasedAt`. */
function isReleased(order: Order): boolean {
  const status = backendStatus(order);
  const effective = status === "ON_HOLD" ? (holdOf(order)?.statusBeforeHold ?? null) : status;
  return effective !== null && RELEASED_STATUSES.includes(effective);
}

/** Trạng thái đơn mà hàng đã rời kho (mock-data không có lô giao cho các đơn này). */
const DELIVERED_LIKE = [
  "DELIVERED",
  "RETURN_REQUESTED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "COMPLETED",
];
const HANDED_OVER = ["SHIPPED", "DELIVERY_FAILED", "RETURNED", ...DELIVERED_LIKE];

/**
 * Lô giao của đơn: lô thật của phiên (đơn Partially Fulfilled seed một lô) hoặc — với đơn mock-data đã giao mà không có lô
 * — một lô giả phủ mọi dòng, để trạng thái đợt (Đang giao / Đã giao) và khoá dời cửa sổ khớp trạng thái đơn.
 */
function shipmentsFor(order: Order): readonly MockShipment[] {
  const real = shipmentsOf(order);
  const status = backendStatus(order);
  if (real.length > 0 || !HANDED_OVER.includes(status)) return real;
  return [
    {
      shipmentId: `${order.orderId}-SHIP-ALL`,
      status: DELIVERED_LIKE.includes(status)
        ? "DELIVERED"
        : status === "RETURNED"
          ? "RETURNED"
          : "HANDED_OVER",
      handedOverAt: order.shippedAt ?? order.placedAt,
      lines: order.lines.map((line) => ({ lineId: line.lineId, quantity: line.quantity })),
    },
  ];
}

const today = () => toLocalIsoDate(new Date().toISOString());

/** BE `DeliveryBatchService.Schedule` của một đơn. */
function scheduleOf(order: Order) {
  const shipments = shipmentsFor(order);
  const closed = isClosed(order);
  const batches = batchesOf(order).map((batch) => {
    const window = windowInForce(order.orderId, batch);
    const state = batchStateOf(order, batch, shipments, closed);
    const released = (batch.seq === 1 && isReleased(order)) || batchHasShipment(batch, shipments);
    return {
      batchId: batch.batchId,
      seq: batch.seq,
      contractWindowStart: batch.contractWindowStart,
      contractWindowEnd: batch.contractWindowEnd,
      windowStart: window.start,
      windowEnd: window.end,
      state,
      late: today() > window.end && state !== "CLOSED" && state !== "DELIVERED",
      ...(released ? { releasedAt: order.confirmedAt ?? order.placedAt } : {}),
      lines: order.lines
        .filter((line) => batch.lineIds.includes(line.lineId))
        .map((line) => ({
          orderLineId: line.lineId,
          sku: line.skuId,
          cartons: line.quantity,
          heldCartons: line.quantity,
        })),
      windowChanges: windowChangesOf(order.orderId)
        .filter((change) => change.batchId === batch.batchId)
        .map(({ batchId: _batchId, ...change }) => change),
    };
  });
  return {
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    contractNumber: `HD-${order.orderNumber}`,
    batches,
  };
}

/** BR-28 "giữ thứ tự": ngày bắt đầu hiệu lực không giảm theo `seq`, khi đợt `batch` bắt đầu `start`. */
function breaksOrder(order: Order, batch: MockBatch, start: string): boolean {
  let before: string | null = null;
  for (const b of batchesOf(order)) {
    const at = b.batchId === batch.batchId ? start : windowInForce(order.orderId, b).start;
    if (before !== null && at < before) return true;
    before = at;
  }
  return false;
}

export function registerOrderScheduleMockRoutes(): void {
  registerMockRoute("GET", "/orders/:id/delivery-batches", async (config) => {
    if (!(await hasMockPermission(SALES_CONTRACT_PERMISSIONS.read)))
      return fail(403, "FORBIDDEN", "Access denied");
    const order = await findOrder(pathParams(config).id ?? "");
    return order ? ok(scheduleOf(order)) : notFound();
  });

  registerMockRoute(
    "POST",
    "/orders/:id/delivery-batches/:batchId/window-change",
    async (config) => {
      // BE: `@RequiresPermission(sales-contracts:UPDATE)` chạy trước mọi kiểm tra khác
      if (!(await hasMockPermission(SALES_CONTRACT_PERMISSIONS.update)))
        return fail(403, "FORBIDDEN", "Access denied");
      const { id = "", batchId = "" } = pathParams(config);
      const body = bodyOf(config);
      const windowStart = text(body.windowStart);
      const windowEnd = text(body.windowEnd);
      const reasonCode = text(body.reasonCode);
      const note = text(body.note);
      const messageId = text(body.evidenceMessageId);
      const uploadId = text(body.evidenceUploadId);
      // WindowChangeRequest: @NotNull windowStart / windowEnd / reasonCode, @NotBlank @Size(1000) note
      if (!windowStart) return invalid("windowStart", "windowStart is required");
      if (!windowEnd) return invalid("windowEnd", "windowEnd is required");
      if (!reasonCode) return invalid("reasonCode", "reasonCode is required");
      if (!note) return invalid("note", "note is required");
      if (note.length > 1000) return invalid("note", "note is at most 1000 characters");
      if (!["CUSTOMER_REQUEST", "SELLER_DELAY"].includes(reasonCode))
        return fail(400, "MALFORMED_REQUEST", "The request body could not be read");
      const order = await findOrder(id);
      if (!order) return notFound();

      // `requireWellFormed`: thứ tự hai đầu, đúng MỘT bằng chứng
      if (windowStart > windowEnd)
        return invalid("windowEnd", "The window starts no later than it ends");
      if (!messageId === !uploadId)
        return invalid("evidence", "The consent is either an uploaded file or a chat message");
      // `check`
      if (isClosed(order))
        return fail(
          409,
          "CONFLICT",
          `Order ${order.orderNumber} is closed: schedule no longer moves`,
        );
      const batch = batchesOf(order).find((b) => b.batchId === batchId);
      if (!batch)
        return fail(404, "DELIVERY_BATCH_NOT_FOUND", "Delivery batch not found on this order");
      if (batchHasShipment(batch, shipmentsFor(order)))
        return fail(
          409,
          "DELIVERY_BATCH_WINDOW_LOCKED",
          "Goods of this delivery batch were handed over; its window no longer moves",
        );
      if (messageId && (!isUuidText(messageId) || messageId === MOCK_STAFF_MESSAGE_ID))
        return invalid("evidenceMessageId", "The consent is a chat message the customer sent");
      if (windowStart < today())
        return invalid("windowStart", "The new window does not start in the past");
      if (breaksOrder(order, batch, windowStart))
        return invalid("windowStart", "Batch would start before the batch before it");

      const before = windowInForce(order.orderId, batch);
      const { useAuthStore } = await import("@/lib/auth/auth-store");
      recordWindowChange(order.orderId, {
        id: crypto.randomUUID(),
        batchId: batch.batchId,
        oldStart: before.start,
        oldEnd: before.end,
        newStart: windowStart,
        newEnd: windowEnd,
        reason: reasonCode,
        note,
        evidenceMessageId: messageId,
        changedBy: useAuthStore.getState().user?.userId ?? "",
        changedAt: new Date().toISOString(),
      });
      return ok(scheduleOf(order));
    },
  );
}
