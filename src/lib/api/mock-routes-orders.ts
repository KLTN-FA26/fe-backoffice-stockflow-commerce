/**
 * Mock routes — Đơn hàng (module 14/17): list / detail / lịch sử / huỷ admin.
 *
 * Trả đúng hợp đồng BE `OrderController` (develop): body `{ success, data }` (interceptor
 * ở client.ts bóc), `OrderResponse` với status UPPER_CASE, PageResponse trang từ 0, lỗi
 * `{ errorCode, message, fieldErrors[], correlationId }`. Mock và BE thật đi chung một
 * đường parse ở `features/order/api.ts`. Store + suy diễn: `mock-routes-orders-store.ts`;
 * release / credit hold / lệnh sản xuất: `mock-routes-orders-actions.ts`.
 * File `mock-routes*.ts` + `mock-adapter.ts` là nơi duy nhất đọc `mock-data.ts`.
 */

import { paginatePage, registerMockRoute } from "./mock-adapter";
import { registerOrderActionMockRoutes } from "./mock-routes-orders-actions";
import {
  CANCELLABLE_STATUSES,
  MOCK_TO_BACKEND_STATUS,
  applyTransition,
  backendStatus,
  error,
  findOrder,
  idParam,
  ok,
  readBody,
  readParams,
  roundMoney,
  sessionHistory,
  toOrderResponse,
} from "./mock-routes-orders-store";

import type { MockHistoryEntry } from "./mock-routes-orders-store";

export { resetOrderMockStore } from "./mock-routes-orders-store";

type OrderResponse = ReturnType<typeof toOrderResponse>;

/** Ngày đặt theo múi giờ Asia/Ho_Chi_Minh — BE lọc `placedFrom/placedTo` cả hai đầu theo ngày VN. */
function placedDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

function compareOrders(a: OrderResponse, b: OrderResponse, field: string): number {
  switch (field) {
    case "orderNumber":
      return a.orderNumber.localeCompare(b.orderNumber);
    case "totalAmount":
      return a.totalAmount - b.totalAmount;
    case "status":
      return a.status.localeCompare(b.status);
    default:
      return new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime();
  }
}

const CANCEL_REASON_CODES = [
  "CUSTOMER_REQUEST",
  "PAYMENT_NOT_RECEIVED",
  "PAYMENT_FAILED",
  "OUT_OF_STOCK",
  "SUSPECTED_FRAUD",
  "CREDIT_REJECTED",
  "DUPLICATE_ORDER",
  "PRODUCTION_ISSUE",
  "OTHER",
];

export function registerOrderMockRoutes(): void {
  // Đăng ký TRƯỚC `/orders/:id`: adapter khớp theo thứ tự đăng ký, `/orders/credit-holds` sẽ bị
  // `/orders/:id` nuốt nếu đăng ký sau.
  registerOrderActionMockRoutes();

  // GET /orders — BE OrderController#list (develop).
  registerMockRoute("GET", "/orders", async (config) => {
    const { orders } = await import("@/lib/mock-data");
    const params = readParams(config);
    const page = Math.max(0, Number(params.get("page")) || 0);
    const size = Math.max(1, Number(params.get("size")) || 15);
    const search = params.get("search")?.trim().toLowerCase();
    const statuses = params.getAll("status");
    const customerId = params.get("customerId");
    const placedFrom = params.get("placedFrom");
    const placedTo = params.get("placedTo");
    const [sortField = "placedAt", sortDir = "desc"] = (
      params.get("sort") ?? "placedAt,desc"
    ).split(",");

    // BE OrderServiceImpl: placedTo trước placedFrom → 400 VALIDATION_FAILED
    if (placedFrom && placedTo && placedTo < placedFrom) {
      return error(400, "VALIDATION_FAILED", "Invalid request data", [
        { field: "placedTo", message: "placedTo must not be before placedFrom", code: "Range" },
      ]);
    }

    let filtered = orders.map(toOrderResponse);
    if (search)
      filtered = filtered.filter((o) =>
        [o.orderNumber, o.contactName, o.contactPhone].some((value) =>
          value.toLowerCase().includes(search),
        ),
      );
    if (statuses.length) filtered = filtered.filter((o) => statuses.includes(o.status));
    if (customerId) filtered = filtered.filter((o) => o.customerId === customerId);
    if (placedFrom) filtered = filtered.filter((o) => placedDay(o.placedAt) >= placedFrom);
    if (placedTo) filtered = filtered.filter((o) => placedDay(o.placedAt) <= placedTo);
    filtered.sort((a, b) => {
      const result = compareOrders(a, b, sortField);
      return sortDir === "desc" ? -result : result;
    });

    // BE: dòng danh sách không mang lines (OrderPersistenceMapper)
    const pageData = paginatePage(filtered, page, size);
    return ok({ ...pageData, items: pageData.items.map((o) => ({ ...o, lines: [] })) });
  });

  // GET /orders/:id
  registerMockRoute("GET", "/orders/:id", async (config) => {
    const order = await findOrder(idParam(config));
    if (!order) return error(404, "NOT_FOUND", "Resource not found");
    return ok(toOrderResponse(order));
  });

  // GET /orders/:id/history — dựng từ `orderEvents` (module 17) + bước phát sinh trong phiên
  registerMockRoute("GET", "/orders/:id/history", async (config) => {
    const order = await findOrder(idParam(config));
    if (!order) return error(404, "NOT_FOUND", "Resource not found");
    const { orderEvents } = await import("@/lib/mock-data");

    const seeded: MockHistoryEntry[] = [];
    for (const event of orderEvents.filter((e) => e.orderId === order.orderId)) {
      if (!event.toStatus) continue;
      const to = MOCK_TO_BACKEND_STATUS[event.toStatus];
      const from = event.fromStatus ? MOCK_TO_BACKEND_STATUS[event.fromStatus] : null;
      // Gộp 20 → 12 trạng thái: bỏ bước nội bộ không đổi trạng thái BE (vd Picking → Packed)
      if (from === to) continue;
      seeded.push({ from, to, reason: event.description, occurredAt: event.createdAt });
    }
    const first: MockHistoryEntry = {
      from: null,
      to: seeded[0]?.from ?? MOCK_TO_BACKEND_STATUS[order.status],
      reason: null,
      occurredAt: order.placedAt,
    };
    return ok([first, ...seeded, ...sessionHistory(order.orderId)]);
  });

  // POST /orders/:id/admin-cancellation — BE OrderController#adminCancel (AdminCancelOrderRequest).
  registerMockRoute("POST", "/orders/:id/admin-cancellation", async (config) => {
    const order = await findOrder(idParam(config));
    // 404 chứ không 403 — không tiết lộ đơn có tồn tại hay không (BE findByIdInScope).
    if (!order) return error(404, "NOT_FOUND", "Resource not found");

    const body = readBody(config);
    const reasonCode = typeof body.reasonCode === "string" ? body.reasonCode : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const retained = typeof body.retainedPercent === "number" ? body.retainedPercent : 0;
    if (!CANCEL_REASON_CODES.includes(reasonCode)) {
      return error(400, "VALIDATION_FAILED", "Invalid request data", [
        { field: "reasonCode", message: "reasonCode is required", code: "NotNull" },
      ]);
    }
    // BE Order#cancelByAdmin: OTHER cần note; retainedPercent 0..100
    if ((reasonCode === "OTHER" && !note) || retained < 0 || retained > 100) {
      return error(400, "VALIDATION_FAILED", "Invalid request data", [
        { field: reasonCode === "OTHER" && !note ? "note" : "retainedPercent", message: "invalid" },
      ]);
    }

    const current = backendStatus(order);
    // BE BR-031 (OrderStatus#canTransitionTo); docs 17 BR-03 → 409 ORDER_NOT_CANCELLABLE
    if (!CANCELLABLE_STATUSES.includes(current)) {
      return error(
        409,
        "ORDER_NOT_CANCELLABLE",
        `Order ${order.orderNumber} cannot be cancelled from status ${current}`,
      );
    }

    applyTransition(order, "CANCELLED", note || reasonCode, {
      cancellation: {
        reasonCode,
        reason: note || null,
        retainedAmount: roundMoney((order.amountPaid * retained) / 100, order.currency),
      },
    });
    return ok(toOrderResponse(order));
  });
}
