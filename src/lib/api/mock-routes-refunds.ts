/**
 * Mock routes — hoàn tiền của đơn hợp đồng (BE `RefundController`, payment module 4B-9, docs 15 §4.5, BR-14):
 *   GET  /refunds?customerId&outstanding          đơn có số tiền phải hoàn (không kèm lần tính / ghi nhận)
 *   GET  /refunds/orders/{orderId}                kèm các lần tính (settlements) và ghi nhận (records)
 *   POST /refunds/orders/{orderId}/records        ghi nhận đã hoàn — không vượt số còn phải hoàn
 *   POST /refunds/records/{recordId}/void         huỷ ghi nhận ghi sai — bắt buộc lý do, số tiền quay lại thành còn phải hoàn
 */

import { registerMockRoute } from "./mock-adapter";
import {
  mockOrderRefunds,
  mockRefundRecords,
  mockToday,
  nextMockPaymentId,
  refundStatusOf,
} from "./mock-payment-store";
import { bodyOf, fail, ok, pageOf, pathParams, queryOf, text } from "./mock-route-utils";
import { cancelledOrderRefund } from "./mock-routes-order-cancellation-requests";
import { can, forbidden } from "./mock-routes-payment";

import type { MockOrderRefund, MockRefundRecord } from "./mock-payment-store";

const REFERENCE = /^[\p{L}\p{N} ._/:#-]+$/u;
const validation = (field: string, message: string) =>
  fail(400, "VALIDATION_FAILED", message, [{ field, message }]);

const recordsOf = (orderId: string) => mockRefundRecords().filter((r) => r.orderId === orderId);

function standing(order: MockOrderRefund) {
  const refundable = order.settlements.reduce((sum, s) => sum + s.refundable, 0);
  const refunded = recordsOf(order.orderId)
    .filter((r) => r.status === "RECORDED")
    .reduce((sum, r) => sum + r.amount, 0);
  return {
    refundable,
    refunded,
    remaining: Math.max(0, refundable - refunded),
    status: refundStatusOf(refundable, refunded),
  };
}

function refundWire(order: MockOrderRefund, detail: boolean) {
  const s = standing(order);
  return {
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    currency: order.currency,
    refundStatus: s.status,
    refundable: s.refundable,
    refunded: s.refunded,
    remaining: s.remaining,
    ...(detail ? { settlements: order.settlements, records: recordsOf(order.orderId) } : {}),
  };
}

function record(orderId: string, body: Record<string, unknown>) {
  const order = mockOrderRefunds().find((o) => o.orderId === orderId);
  if (!order) return fail(404, "NOT_FOUND", `No order ${orderId}`);
  const amount = Number(body.amount);
  const refundedOn = text(body.refundedOn);
  const reference = text(body.reference);
  if (!Number.isInteger(amount) || amount < 1)
    return validation("amount", "amount is a whole number of dong, at least 1");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(refundedOn) || refundedOn > mockToday())
    return validation("refundedOn", "refundedOn is required and not after today");
  if (!reference || reference.length > 100 || !REFERENCE.test(reference))
    return validation("reference", "reference is required, at most 100 characters");
  if (mockRefundRecords().some((r) => r.status === "RECORDED" && r.reference === reference))
    return fail(
      409,
      "REFUND_REFERENCE_IN_USE",
      "This bank statement line is already recorded as a refund",
    );
  // BR-14 (docs 15 §6): tổng ghi nhận đã hoàn không vượt số phải hoàn
  if (amount > standing(order).remaining)
    return fail(
      409,
      "REFUND_EXCEEDS_REFUNDABLE",
      "This refund is more than the order still has to refund",
    );
  const saved: MockRefundRecord = {
    refundRecordId: nextMockPaymentId("RFD"),
    orderId,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    amount,
    currency: order.currency,
    refundedOn,
    reference,
    note: text(body.note) || null,
    status: "RECORDED",
    recordedAt: new Date().toISOString(),
    voidedAt: null,
    voidReason: null,
  };
  mockRefundRecords().unshift(saved);
  return ok(refundWire(order, true), 201);
}

function voidRecord(recordId: string, body: Record<string, unknown>) {
  const found = mockRefundRecords().find((r) => r.refundRecordId === recordId);
  if (!found) return fail(404, "REFUND_RECORD_NOT_FOUND", `No refund record ${recordId}`);
  const reason = text(body.reason);
  if (!reason || reason.length > 500)
    return validation("reason", "reason is required, at most 500 characters");
  if (found.status === "VOIDED")
    return fail(409, "REFUND_RECORD_ALREADY_VOIDED", "This refund record is already voided");
  Object.assign(found, {
    status: "VOIDED",
    voidedAt: new Date().toISOString(),
    voidReason: reason,
  });
  return ok(
    refundWire(
      mockOrderRefunds().find((o) => o.orderId === found.orderId)!,
      true,
    ),
  );
}

export function registerRefundMockRoutes(): void {
  registerMockRoute("GET", "/refunds", async (config) => {
    if (!(await can("payment-refunds:READ"))) return forbidden();
    const q = queryOf(config);
    const rows = mockOrderRefunds()
      .filter((o) => !q.get("customerId") || o.customerId === q.get("customerId"))
      .filter((o) => q.get("outstanding") !== "true" || standing(o).remaining > 0)
      .map((o) => refundWire(o, false));
    return ok(pageOf(rows, Number(q.get("page") ?? 0), Number(q.get("size") ?? 20)));
  });
  registerMockRoute("GET", "/refunds/orders/:orderId", async (config) => {
    if (!(await can("payment-refunds:READ"))) return forbidden();
    const orderId = pathParams(config).orderId ?? "";
    const order = mockOrderRefunds().find((o) => o.orderId === orderId);
    if (order) return ok(refundWire(order, true));
    // Đơn huỷ chưa có dòng riêng trong kho: số liệu suy từ bản ghi huỷ của đơn (`mock-routes-order-cancellation-requests`)
    const cancelled = await cancelledOrderRefund(orderId);
    return cancelled ? ok(cancelled) : fail(404, "NOT_FOUND", "No order");
  });
  registerMockRoute("POST", "/refunds/orders/:orderId/records", async (config) =>
    (await can("payment-refunds:CREATE"))
      ? record(pathParams(config).orderId ?? "", bodyOf(config))
      : forbidden(),
  );
  registerMockRoute("POST", "/refunds/records/:recordId/void", async (config) =>
    (await can("payment-refunds:UPDATE"))
      ? voidRecord(pathParams(config).recordId ?? "", bodyOf(config))
      : forbidden(),
  );
}
