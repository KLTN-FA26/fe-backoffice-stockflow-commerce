/**
 * Mock routes — yêu cầu huỷ của khách, theo hợp đồng BE `CancellationRequestController` /
 * `CancellationRequestService` (docs 17 §4.8 bước 28–31, §5.4) + kết quả tất toán `GET /refunds/orders/:id`
 * (BE `RefundController`, docs 15 §4.5–4.6):
 *
 * - GET  /orders/cancellation-requests?status&orderId&page&size — `sales-order-cancellations:READ`, mới nhất trước.
 *   Đăng ký TRƯỚC `/orders/:id` (adapter khớp theo thứ tự đăng ký).
 * - POST /orders/:id/cancellation-requests/:requestId/approval {note?, retainedPercent? | agreedFee?} —
 *   `sales-order-cancellations:UPDATE`; huỷ đơn như huỷ admin (cùng ORDER_NOT_CANCELLABLE sau thùng đầu tiên dán nhãn,
 *   cùng CANCELLATION_FEE_BEFORE_PRINTING) và đóng yêu cầu; yêu cầu đã quyết / hết hiệu lực → 409 NOT_PENDING.
 * - POST …/rejection {note} — ghi lý do bắt buộc; đơn tiếp tục.
 * - GET  /refunds/orders/:id — `payment-refunds:READ`; số liệu tất toán suy từ lần huỷ (đã thu → trả phí trước → phần thừa
 *   phải hoàn → phí thiếu thành khoản phí huỷ).
 *
 * Chỉ dùng khi USE_MOCK=true.
 */

import {
  CANCELLATION_REQUEST_PERMISSIONS,
  ORDER_PERMISSIONS,
  PAYMENT_REFUND_PERMISSIONS,
} from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import {
  allCancellationRequests,
  cancellationRequestById,
  ensureCancellationRequestsSeeded,
  saveCancellationRequest,
} from "./mock-order-cancellation-requests";
import { bodyOf, fail, ok, pageOf, pathParams, queryOf, text } from "./mock-route-utils";
import { hasMockPermission } from "./mock-routes-order-schedule";
import {
  CANCELLABLE_STATUSES,
  applyTransition,
  backendStatus,
  findOrder,
  packedOnlyAheadOfPrints,
  printingStarted,
  roundMoney,
  toOrderResponse,
  wasPacked,
} from "./mock-routes-orders-store";

import type { MockCancellationRequest } from "./mock-order-cancellation-requests";
import type { Order } from "@/lib/mock-data";

const forbidden = () => fail(403, "FORBIDDEN", "Access denied");
const invalid = (field: string, message: string) =>
  fail(400, "VALIDATION_FAILED", "Invalid request data", [{ field, message }]);
const REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED", "EXPIRED"];

async function loadRequests(): Promise<MockCancellationRequest[]> {
  const { orders } = await import("@/lib/mock-data");
  ensureCancellationRequestsSeeded(orders);
  return allCancellationRequests();
}

/** BE `Order#cancel` còn cho huỷ: có cạnh → CANCELLED và chưa đóng gói (trừ hàng có sẵn đóng trước hàng in). */
function cancellable(order: Order): boolean {
  const current = backendStatus(order);
  if (!CANCELLABLE_STATUSES.includes(current) || current === "CANCELLED") return false;
  return !wasPacked(order) || packedOnlyAheadOfPrints(order);
}

/**
 * BE `SalesOrderCancellationListener`: đơn tới mức không huỷ được (thùng dán nhãn, đã huỷ…) → yêu cầu đang chờ tự
 * `EXPIRED` kèm ghi chú. Mock đồng bộ ở lần đọc / quyết định kế tiếp.
 */
async function expireStale(requests: readonly MockCancellationRequest[]): Promise<void> {
  for (const request of requests) {
    if (request.status !== "PENDING") continue;
    const order = await findOrder(request.orderId);
    if (!order || cancellable(order)) continue;
    saveCancellationRequest({
      ...request,
      status: "EXPIRED",
      decidedAt: new Date().toISOString(),
      decisionNote: "The order can no longer be cancelled; raise a return instead",
      version: request.version + 1,
    });
  }
}

/** BE `CancellationRequestResponse` — null bị bỏ khỏi JSON ở `ok()`. */
const toResponse = (request: MockCancellationRequest) => ({ ...request });

function readFee(
  value: unknown,
): { amount: number; reason: string; detail: string } | null | "invalid" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object") return "invalid";
  const fee = value as Record<string, unknown>;
  const reason = typeof fee.reason === "string" ? fee.reason.trim() : "";
  const detail = typeof fee.detail === "string" ? fee.detail.trim() : "";
  if (typeof fee.amount !== "number" || !(fee.amount > 0)) return "invalid";
  if (!reason || reason.length > 500 || !detail || detail.length > 2000) return "invalid";
  return { amount: fee.amount, reason, detail };
}

function registerListRoute(): void {
  registerMockRoute("GET", "/orders/cancellation-requests", async (config) => {
    if (!(await hasMockPermission(CANCELLATION_REQUEST_PERMISSIONS.read))) return forbidden();
    const query = queryOf(config);
    const status = query.get("status");
    if (status && !REQUEST_STATUSES.includes(status))
      return fail(400, "UNSUPPORTED_PARAMETER", "Unsupported parameter", [
        { field: "status", message: "must be CancellationRequestStatus" },
      ]);
    await expireStale(await loadRequests());
    const orderId = query.get("orderId");
    const items = allCancellationRequests()
      .filter((r) => (!status || r.status === status) && (!orderId || r.orderId === orderId))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    const page = Math.max(0, Number(query.get("page") ?? 0) || 0);
    const size = Math.max(1, Number(query.get("size") ?? 20) || 20);
    return ok({
      ...pageOf(items, page, size),
      items: pageOf(items, page, size).items.map(toResponse),
    });
  });
}

/** Trả `{request, order}` hoặc phản hồi lỗi — đúng thứ tự BE `CancellationRequestService#load` rồi `requirePending`. */
async function loadForDecision(config: Parameters<typeof pathParams>[0]) {
  const { id = "", requestId = "" } = pathParams(config);
  await expireStale(await loadRequests());
  const request = cancellationRequestById(requestId);
  const order = await findOrder(id);
  if (!request || request.orderId !== id || !order)
    return { error: fail(404, "CANCELLATION_REQUEST_NOT_FOUND", "No cancellation request") };
  return { request, order };
}

function registerDecisionRoutes(): void {
  registerMockRoute(
    "POST",
    "/orders/:id/cancellation-requests/:requestId/approval",
    async (config) => {
      if (!(await hasMockPermission(ORDER_PERMISSIONS.cancel))) return forbidden();
      const body = bodyOf(config);
      const percent = body.retainedPercent;
      if (percent !== undefined && percent !== null && typeof percent !== "number")
        return fail(400, "MALFORMED_REQUEST", "The request body could not be read");
      if (typeof percent === "number" && (percent < 0 || percent > 100))
        return invalid("retainedPercent", "retainedPercent is between 0 and 100");
      const note = text(body.note);
      if (note.length > 1000) return invalid("note", "note is at most 1000 characters");
      const fee = readFee(body.agreedFee);
      if (fee === "invalid") return invalid("agreedFee", "amount, reason and detail are required");
      const loaded = await loadForDecision(config);
      if (loaded.error) return loaded.error;
      const { request, order } = loaded;
      if (request.status !== "PENDING")
        return fail(
          409,
          "ORDER_CANCELLATION_REQUEST_NOT_PENDING",
          `Request is already ${request.status}`,
        );
      if (fee && typeof percent === "number")
        return invalid("agreedFee", "Keep a percentage or an agreed amount, not both");
      if (fee && fee.amount > order.grandTotal)
        return invalid("agreedFee", "The agreed amount is at most what the order is worth");
      if (!cancellable(order))
        return fail(
          409,
          "ORDER_NOT_CANCELLABLE",
          `Order ${order.orderNumber} can no longer be cancelled`,
        );
      const keeps = fee !== null || (typeof percent === "number" && percent > 0);
      if (keeps && !printingStarted(order))
        return fail(
          409,
          "CANCELLATION_FEE_BEFORE_PRINTING",
          "Printing has not started: no fee is kept",
        );

      // Mock giữ số tiền phí trên `cancellation.retainedAmount` (như huỷ admin) để `/refunds/orders/:id` tính tiếp
      const retained = fee
        ? Math.min(fee.amount, order.amountPaid)
        : roundMoney(
            (order.amountPaid * (typeof percent === "number" ? percent : 0)) / 100,
            order.currency,
          );
      const reasonText = request.note
        ? `${request.reasonCode}: ${request.note}`
        : request.reasonCode;
      saveCancellationRequest({
        ...request,
        status: "APPROVED",
        decidedBy: "USER-SALE-01",
        decidedAt: new Date().toISOString(),
        decisionNote: note || null,
        retainedPercent: typeof percent === "number" && percent > 0 ? percent : null,
        version: request.version + 1,
      });
      applyTransition(order, "CANCELLED", reasonText, {
        cancellation: {
          reasonCode: request.reasonCode,
          reason: reasonText,
          retainedAmount: retained,
          feeReason: fee?.reason ?? null,
          feeDetail: fee?.detail ?? null,
          feeAmount: fee?.amount ?? null,
        },
      });
      return ok(toOrderResponse(order));
    },
  );

  registerMockRoute(
    "POST",
    "/orders/:id/cancellation-requests/:requestId/rejection",
    async (config) => {
      if (!(await hasMockPermission(ORDER_PERMISSIONS.cancel))) return forbidden();
      const note = text(bodyOf(config).note);
      if (!note) return invalid("note", "note is required");
      if (note.length > 1000) return invalid("note", "note is at most 1000 characters");
      const loaded = await loadForDecision(config);
      if (loaded.error) return loaded.error;
      const { request } = loaded;
      if (request.status !== "PENDING")
        return fail(
          409,
          "ORDER_CANCELLATION_REQUEST_NOT_PENDING",
          `Request is already ${request.status}`,
        );
      const rejected: MockCancellationRequest = {
        ...request,
        status: "REJECTED",
        decidedBy: "USER-SALE-01",
        decidedAt: new Date().toISOString(),
        decisionNote: note,
        version: request.version + 1,
      };
      saveCancellationRequest(rejected);
      return ok(toResponse(rejected));
    },
  );
}

/** BE `OrderRefundResponse` của một đơn đã huỷ: tiền đã thu trả phí trước (docs 15 §4.5–4.6, `OrderSettlement#cancel`). */
function registerRefundRoute(): void {
  registerMockRoute("GET", "/refunds/orders/:id", async (config) => {
    if (!(await hasMockPermission(PAYMENT_REFUND_PERMISSIONS.read))) return forbidden();
    const order = await findOrder(pathParams(config).id ?? "");
    if (!order) return fail(404, "NOT_FOUND", "Resource not found");
    const base = {
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      currency: order.currency,
    };
    const cancellation = toOrderResponse(order).cancellation;
    if (backendStatus(order) !== "CANCELLED" || !cancellation)
      return ok({
        ...base,
        refundStatus: "NONE",
        refundable: 0,
        refunded: 0,
        remaining: 0,
        settlements: [],
        records: [],
      });
    const collected = order.amountPaid;
    const fee = cancellation.feeAmount ?? cancellation.retainedAmount ?? 0;
    const approved = (await loadRequests()).find(
      (r) => r.orderId === order.orderId && r.status === "APPROVED",
    );
    const covered = Math.min(fee, collected);
    const refundable = collected - covered;
    return ok({
      ...base,
      refundStatus: refundable > 0 ? "PENDING" : "NONE",
      refundable,
      refunded: 0,
      remaining: refundable,
      settlements: [
        {
          settlementId: `SETTLE-${order.orderId}`,
          kind: "ORDER_CANCELLED",
          collected,
          closed: 0,
          reduced: 0,
          surplus: collected,
          fee,
          feePercent: approved?.retainedPercent ?? null,
          feeReason: cancellation.feeReason ?? null,
          feeDetail: cancellation.feeDetail ?? null,
          feeCovered: covered,
          refundable,
          feeOwed: fee - covered,
          settledAt: new Date().toISOString(),
        },
      ],
      records: [],
    });
  });
}

export function registerOrderCancellationRequestMockRoutes(): void {
  registerListRoute();
  registerDecisionRoutes();
  registerRefundRoute();
}
