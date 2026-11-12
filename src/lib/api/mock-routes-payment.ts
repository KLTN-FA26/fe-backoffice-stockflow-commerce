/**
 * Mock routes — đợt thanh toán và phiếu thu (BE `InstallmentController` + `PaymentReceiptController`,
 * payment module 4B-6, docs 15):
 *   GET  /installments?customerId&orderId&status&milestone&dueBefore&reached&page&size&sort
 *   GET  /installments/orders/{orderId}     đợt của một đơn + trạng thái thanh toán (§5.2)
 *   GET  /installments/{id}                 kèm các phiếu thu đã trả (cả phiếu đã huỷ)
 *   GET  /payment-receipts, GET /payment-receipts/{id}
 *   POST /payment-receipts                  lập phiếu thu (BR-02..BR-05)
 *   POST /payment-receipts/{id}/void        huỷ phiếu thu (BR-04, BR-13)
 * Thứ tự kiểm như BE: mã tham chiếu trùng → đợt (không thấy / khác khách / không nhận tiền) → vượt số còn phải thu.
 */

import { registerMockRoute } from "./mock-adapter";
import {
  mockInstallments,
  mockReceipts,
  mockToday,
  nextMockPaymentId,
  outstandingOf,
  statusOf,
} from "./mock-payment-store";
import { bodyOf, fail, ok, pageOf, pathParams, queryOf, text } from "./mock-route-utils";
import { backendOrderStatusOf } from "./mock-routes-orders-store";

import type { AxiosRequestConfig } from "axios";
import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { MockInstallment, MockReceipt } from "./mock-payment-store";

const REFERENCE = /^[\p{L}\p{N} ._/:#-]+$/u;
const INTEGER = /^\d{1,15}$/;
/** Đơn đã chốt tiền: huỷ phiếu thu không còn nghĩa (docs 15 §4.4 bước 13). */
const SETTLED_ORDERS = [
  "CANCELLED",
  "COMPLETED",
  "CLOSED",
  "RETURN_REQUESTED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
];

const validation = (field: string, message: string) =>
  fail(400, "VALIDATION_FAILED", message, [{ field, message }]);
export const forbidden = () => fail(403, "FORBIDDEN", "Forbidden");

const byId = (id: string) => mockInstallments().find((i) => i.installmentId === id);

function receiptsOf(installmentId: string) {
  return mockReceipts().flatMap((r) =>
    r.lines
      .filter((line) => line.installmentId === installmentId)
      .map((line) => ({
        receiptId: r.receiptId,
        reference: r.reference,
        receivedOn: r.receivedOn,
        amount: line.amount,
        status: r.status,
        recordedAt: r.recordedAt,
      })),
  );
}

export function installmentWire(i: MockInstallment, withReceipts = false) {
  return {
    installmentId: i.installmentId,
    contractId: i.contractId,
    contractNumber: i.contractNumber,
    orderId: i.orderId,
    orderNumber: i.orderNumber,
    customerId: i.customerId,
    seq: i.seq,
    name: i.name,
    milestone: i.milestone,
    deliveryBatchSeq: i.deliveryBatchSeq,
    amount: i.amount,
    paidAmount: i.paidAmount,
    reducedAmount: i.reducedAmount,
    outstanding: outstandingOf(i),
    currency: i.currency,
    dueDays: i.dueDays,
    reachedAt: i.reachedAt,
    dueDate: i.dueDate,
    status: statusOf(i),
    transferReference: `${i.contractNumber} DOT${i.seq}`,
    ...(withReceipts ? { receipts: receiptsOf(i.installmentId) } : {}),
  };
}

const receiptWire = (r: MockReceipt, withFacts: boolean) => ({
  ...r,
  lines: r.lines.map((line) => {
    const i = withFacts ? byId(line.installmentId) : undefined;
    return {
      ...line,
      ...(i
        ? {
            contractNumber: i.contractNumber,
            orderId: i.orderId,
            orderNumber: i.orderNumber,
            seq: i.seq,
            name: i.name,
            milestone: i.milestone,
          }
        : {}),
    };
  }),
});

function sorted<T>(
  rows: T[],
  sort: string | null,
  keys: Record<string, (row: T) => string | number>,
  fallback: string,
) {
  const [key, dir] = (sort ?? fallback).split(",");
  const pick = keys[key ?? ""] ?? keys[fallback.split(",")[0]!]!;
  const sign = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => (pick(a) < pick(b) ? -sign : pick(a) > pick(b) ? sign : 0));
}

function paging(q: URLSearchParams) {
  return { page: Number(q.get("page") ?? 0), size: Number(q.get("size") ?? 20) };
}

/** Quyền của người dùng demo đang đăng nhập (cùng nguồn với `/identity/me/permissions`). */
export async function can(code: PermissionCode): Promise<boolean> {
  const [{ useAuthStore }, { mockGrantsOf }] = await Promise.all([
    import("@/lib/auth/auth-store"),
    import("./mock-user-grants"),
  ]);
  return mockGrantsOf(useAuthStore.getState().user?.userId ?? "").has(code);
}

function listInstallments(config: AxiosRequestConfig) {
  const q = queryOf(config);
  const reached = q.get("reached");
  const status = q.get("status");
  const rows = mockInstallments().filter(
    (i) =>
      (!q.get("customerId") || i.customerId === q.get("customerId")) &&
      (!q.get("orderId") || i.orderId === q.get("orderId")) &&
      (!status || statusOf(i) === status) &&
      (!q.get("milestone") || i.milestone === q.get("milestone")) &&
      (!q.get("dueBefore") || (i.dueDate !== null && i.dueDate < (q.get("dueBefore") ?? ""))) &&
      (reached === null || (i.reachedAt !== null) === (reached === "true")),
  );
  const keys = {
    dueDate: (i: MockInstallment) => i.dueDate ?? "9999",
    amount: (i: MockInstallment) => i.amount,
    status: (i: MockInstallment) => statusOf(i),
  };
  const { page, size } = paging(q);
  return pageOf(
    sorted(rows, q.get("sort"), keys, "dueDate,asc").map((i) => installmentWire(i)),
    page,
    size,
  );
}

function orderInstallments(orderId: string) {
  const rows = mockInstallments().filter((i) => i.orderId === orderId);
  const first = rows[0];
  if (!first) return null;
  const live = rows.filter((i) => !i.cancelled);
  const total = live.reduce((sum, i) => sum + i.amount - i.reducedAmount, 0);
  const paid = live.reduce((sum, i) => sum + i.paidAmount, 0);
  const onSigning = live.filter((i) => i.milestone === "ON_SIGNING");
  const beforeDelivery = live
    .filter((i) => i.milestone === "BEFORE_DELIVERY")
    .reduce((sum, i) => sum + outstandingOf(i), 0);
  return {
    orderId,
    orderNumber: first.orderNumber,
    contractNumber: first.contractNumber,
    ...(live.length === 0
      ? {}
      : { paymentStatus: paid <= 0 ? "UNPAID" : paid >= total ? "PAID" : "PARTIALLY_PAID" }),
    total,
    paid,
    outstanding: total - paid,
    onSigningPaid: onSigning.every((i) => outstandingOf(i) === 0),
    beforeDeliveryUnpaid: beforeDelivery,
    dueBeforeHandover: beforeDelivery + onSigning.reduce((sum, i) => sum + outstandingOf(i), 0),
    currency: first.currency,
    installments: rows.map((i) => installmentWire(i)),
  };
}

type Line = { installmentId: string; amount: number };

function recordReceipt(body: Record<string, unknown>) {
  const reference = text(body.reference);
  const receivedOn = text(body.receivedOn);
  const customerId = text(body.customerId);
  const lines = (Array.isArray(body.lines) ? body.lines : []) as Line[];
  if (!reference || reference.length > 100 || !REFERENCE.test(reference))
    return validation(
      "reference",
      "reference is required, at most 100 characters of letters, digits and . _ / : # -",
    );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedOn) || receivedOn > mockToday())
    return validation("receivedOn", "receivedOn is required and not after today");
  if (lines.length === 0 || lines.length > 100)
    return validation("lines", "a receipt pays 1 to 100 installments");
  if (lines.some((l) => !INTEGER.test(String(l.amount)) || Number(l.amount) < 1))
    return validation("lines", "amount is a whole number of dong, at least 1");
  if (mockReceipts().some((r) => r.status === "RECORDED" && r.reference === reference))
    return fail(
      409,
      "PAYMENT_RECEIPT_REFERENCE_IN_USE",
      "This bank statement line is already recorded",
    );
  const owed = new Map<string, number>();
  for (const line of lines) {
    const i = byId(line.installmentId);
    if (!i) return fail(404, "INSTALLMENT_NOT_FOUND", `No installment ${line.installmentId}`);
    if (i.customerId !== customerId)
      return fail(
        409,
        "INSTALLMENT_CUSTOMER_MISMATCH",
        "This installment belongs to another customer",
      );
    if (statusOf(i) === "PAID" || statusOf(i) === "CANCELLED")
      return fail(
        409,
        "INSTALLMENT_NOT_PAYABLE",
        "This installment is paid or cancelled; it takes no more money",
      );
    owed.set(i.installmentId, (owed.get(i.installmentId) ?? 0) + Number(line.amount));
  }
  for (const [id, amount] of owed)
    if (amount > outstandingOf(byId(id)!))
      return fail(
        409,
        "PAYMENT_RECEIPT_EXCEEDS_OUTSTANDING",
        "A line pays more than its installment still owes",
      );
  for (const [id, amount] of owed) byId(id)!.paidAmount += amount;
  const saved: MockReceipt = {
    receiptId: nextMockPaymentId("RCP"),
    customerId,
    reference,
    receivedOn,
    amount: lines.reduce((sum, l) => sum + Number(l.amount), 0),
    currency: byId(lines[0]!.installmentId)!.currency,
    note: text(body.note) || null,
    status: "RECORDED",
    recordedAt: new Date().toISOString(),
    voidedAt: null,
    voidReason: null,
    lines: lines.map((l) => ({ installmentId: l.installmentId, amount: Number(l.amount) })),
  };
  mockReceipts().unshift(saved);
  return ok(receiptWire(saved, true), 201);
}

async function voidReceipt(id: string, body: Record<string, unknown>) {
  const found = mockReceipts().find((r) => r.receiptId === id);
  if (!found) return fail(404, "PAYMENT_RECEIPT_NOT_FOUND", `No payment receipt ${id}`);
  const reason = text(body.reason);
  if (!reason || reason.length > 500)
    return validation("reason", "reason is required, at most 500 characters");
  if (found.status === "VOIDED")
    return fail(409, "PAYMENT_RECEIPT_ALREADY_VOIDED", "This payment receipt is already voided");
  const touched = found.lines.map((l) => byId(l.installmentId)!);
  const states = await Promise.all(touched.map((i) => backendOrderStatusOf(i.orderId)));
  if (
    touched.some(
      (i, n) =>
        i.milestone !== "CANCELLATION_FEE" &&
        (statusOf(i) === "CANCELLED" || SETTLED_ORDERS.includes(states[n] ?? "")),
    )
  )
    return fail(
      409,
      "PAYMENT_RECEIPT_VOID_NOT_ALLOWED",
      "This payment receipt can no longer be voided",
    );
  const leavesShort = touched.some(
    (i, n) => i.milestone === "ON_SIGNING" && outstandingOf(i) === 0 && states[n] === "CONFIRMED",
  );
  if (leavesShort && body.holdOrders !== true)
    return fail(
      409,
      "PAYMENT_RECEIPT_VOID_NEEDS_HOLD",
      "Voiding this receipt leaves a confirmed order unpaid: confirm putting it on hold",
    );
  found.lines.forEach((l) => (byId(l.installmentId)!.paidAmount -= l.amount));
  Object.assign(found, {
    status: "VOIDED",
    voidedAt: new Date().toISOString(),
    voidReason: reason,
  });
  return ok(receiptWire(found, true));
}

export function registerPaymentMockRoutes(): void {
  registerMockRoute("GET", "/installments", async (config) =>
    (await can("payment-installments:READ")) ? ok(listInstallments(config)) : forbidden(),
  );
  registerMockRoute("GET", "/installments/orders/:orderId", async (config) => {
    if (!(await can("payment-installments:READ"))) return forbidden();
    const view = orderInstallments(pathParams(config).orderId ?? "");
    return view ? ok(view) : fail(404, "INSTALLMENT_NOT_FOUND", "No installment for this order");
  });
  registerMockRoute("GET", "/installments/:id", async (config) => {
    if (!(await can("payment-installments:READ"))) return forbidden();
    const i = byId(pathParams(config).id ?? "");
    return i
      ? ok(installmentWire(i, true))
      : fail(404, "INSTALLMENT_NOT_FOUND", "Installment not found");
  });
  registerMockRoute("GET", "/payment-receipts", async (config) => {
    if (!(await can("payment-receipts:READ"))) return forbidden();
    const q = queryOf(config);
    const rows = mockReceipts().filter(
      (r) =>
        (!q.get("customerId") || r.customerId === q.get("customerId")) &&
        (!q.get("status") || r.status === q.get("status")) &&
        (!q.get("reference") || r.reference === q.get("reference")),
    );
    const keys = {
      receivedOn: (r: MockReceipt) => r.receivedOn,
      recordedAt: (r: MockReceipt) => r.recordedAt,
      amount: (r: MockReceipt) => r.amount,
    };
    const { page, size } = paging(q);
    return ok(
      pageOf(
        sorted(rows, q.get("sort"), keys, "recordedAt,desc").map((r) => receiptWire(r, false)),
        page,
        size,
      ),
    );
  });
  registerMockRoute("GET", "/payment-receipts/:id", async (config) => {
    if (!(await can("payment-receipts:READ"))) return forbidden();
    const r = mockReceipts().find((x) => x.receiptId === pathParams(config).id);
    return r
      ? ok(receiptWire(r, true))
      : fail(404, "PAYMENT_RECEIPT_NOT_FOUND", "Payment receipt not found");
  });
  registerMockRoute("POST", "/payment-receipts", async (config) =>
    (await can("payment-receipts:CREATE")) ? recordReceipt(bodyOf(config)) : forbidden(),
  );
  registerMockRoute("POST", "/payment-receipts/:id/void", async (config) =>
    (await can("payment-receipts:UPDATE"))
      ? voidReceipt(pathParams(config).id ?? "", bodyOf(config))
      : forbidden(),
  );
}
