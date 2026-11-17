/**
 * Mock routes — yêu cầu trả hàng (BE `ReturnRequestController` + `ReturnResolutionController`, docs 17 §4.10):
 *   GET  /returns?status&orderId&customerId&search&vatAdjustment   hàng đợi back-office
 *   GET  /returns/{id}                                             chi tiết (ảnh, phiếu nhập, hoàn tiền, lịch sử)
 *   GET  /returns/{id}/evidence/{evidenceId}/download-url          link ảnh 5 phút
 *   POST /orders/{orderId}/returns                                 Sale mở thay khách (idempotent theo requestId)
 *   POST /returns/{id}/approval | rejection | cancellation         Sale duyệt / từ chối / rút
 *   POST /returns/{id}/resolution                                  Sale đề xuất hoàn tiền (RECEIVED)
 *   POST /returns/{id}/settlement-approval | settlement-rejection  Kế toán duyệt / trả lại (SETTLEMENT_PENDING)
 * Kiểm `version` như BE (409 OPTIMISTIC_LOCK), trạng thái nguồn (409 RETURN_INVALID_TRANSITION) và trần số lượng.
 */

import { registerMockRoute } from "./mock-adapter";
import { mockReturns, nextMockReturnId, MOCK_RETURN_WAREHOUSE } from "./mock-returns-store";
import { mockCustomerUuid } from "./mock-routes-orders-store";
import {
  bodyOf,
  fail,
  ok,
  optimisticLock,
  pageOf,
  pathParams,
  queryOf,
  text,
} from "./mock-route-utils";

import type { ReturnApiStatus, ReturnReason } from "@/constants/returns";
import type { MockReturn } from "./mock-returns-store";

const now = () => new Date().toISOString();
const byId = (id: string) => mockReturns().find((r) => r.id === id);
const notFound = (id: string) => fail(404, "RETURN_REQUEST_NOT_FOUND", `No return request ${id}`);
const invalid = (status: string) =>
  fail(409, "RETURN_INVALID_TRANSITION", `Not allowed from ${status}`);

const VAT = 0.08;

function wire(ret: MockReturn) {
  const { warehouseId: _warehouse, ...rest } = ret;
  void _warehouse;
  return { ...rest, discrepancies: [], history: ret.history.map((h) => ({ ...h, actorId: null })) };
}

function row(ret: MockReturn) {
  const resolution = ret.resolution ?? {};
  return {
    id: ret.id,
    rmaNumber: ret.rmaNumber,
    orderId: ret.orderId,
    orderNumber: ret.orderNumber,
    customerId: ret.customerId,
    status: ret.status,
    reasonCode: ret.reasonCode,
    requestedResolution: "REFUND",
    channel: ret.channel,
    requestedAt: ret.requestedAt,
    returnDeadline: ret.review?.returnDeadline ?? null,
    settlementAmount: resolution.settlementAmount ?? null,
    refundedAmount: resolution.refundedAmount ?? null,
    offsetAmount: resolution.offsetAmount ?? null,
    currency: ret.currency,
    vatAdjustmentRequired: ret.status === "RESOLVED" && resolution.vatAdjustmentRequired === true,
    closedAt: ret.closedAt,
    version: ret.version,
  };
}

function move(ret: MockReturn, to: ReturnApiStatus, reason: string | null = null) {
  ret.history.push({ from: ret.status, to, reason, occurredAt: now() });
  ret.status = to;
  ret.version += 1;
}

/** Bản ghi đã đổi kể từ khi màn tải → 409 OPTIMISTIC_LOCK (BE `ReturnRequests` version). */
const stale = (ret: MockReturn, body: Record<string, unknown>) =>
  typeof body.version === "number" && body.version !== ret.version;

function list(params: URLSearchParams) {
  const statuses = params.getAll("status");
  const search = params.get("search")?.trim().toLowerCase();
  const items = mockReturns()
    .filter((r) => !statuses.length || statuses.includes(r.status))
    .filter((r) => !params.get("orderId") || r.orderId === params.get("orderId"))
    .filter((r) => !params.get("customerId") || r.customerId === params.get("customerId"))
    .filter((r) => !search || `${r.rmaNumber} ${r.orderNumber}`.toLowerCase().includes(search))
    .map(row)
    .filter((r) => params.get("vatAdjustment") !== "true" || r.vatAdjustmentRequired)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  return ok(pageOf(items, Number(params.get("page") ?? 0), Number(params.get("size") ?? 15)));
}

function approve(ret: MockReturn, body: Record<string, unknown>) {
  if (stale(ret, body)) return optimisticLock();
  if (ret.status !== "REQUESTED") return invalid(ret.status);
  if (!ret.evidence.length) return fail(409, "RETURN_EVIDENCE_REQUIRED", "Add a photo first");
  if (ret.requestedBy === "mock-current-user")
    return fail(409, "RETURN_SELF_APPROVAL", "Self approval");
  const lines = Array.isArray(body.lines)
    ? (body.lines as { lineId?: string; approvedQuantity?: number }[])
    : [];
  for (const l of ret.lines) {
    const given = lines.find((x) => x.lineId === l.id);
    const qty = given?.approvedQuantity ?? l.requestedQuantity;
    if (qty < 0 || qty > l.requestedQuantity)
      return fail(400, "RETURN_QUANTITIES_INVALID", "Approve between 0 and the units asked");
    l.approvedQuantity = qty;
  }
  if (ret.lines.every((l) => (l.approvedQuantity ?? 0) === 0))
    return fail(400, "RETURN_QUANTITIES_INVALID", "Approve at least one unit");
  const deadline = new Date(Date.now() + 14 * 86_400_000).toISOString();
  ret.review = {
    decidedBy: "mock-current-user",
    decidedAt: now(),
    note: text(body.note) || null,
    returnRequired: true,
    returnDeadline: deadline,
  };
  move(ret, "AWAITING_RETURN");
  return ok(wire(ret));
}

function reject(ret: MockReturn, body: Record<string, unknown>) {
  if (stale(ret, body)) return optimisticLock();
  if (ret.status !== "REQUESTED") return invalid(ret.status);
  const reason = text(body.reason);
  if (!reason)
    return fail(400, "VALIDATION_FAILED", "reason is required", [
      { field: "reason", message: "required" },
    ]);
  ret.review = { decidedBy: "mock-current-user", decidedAt: now(), rejectionReason: reason };
  ret.closedAt = now();
  move(ret, "REJECTED", reason);
  return ok(wire(ret));
}

function cancel(ret: MockReturn, body: Record<string, unknown>) {
  if (ret.status !== "REQUESTED" && ret.status !== "AWAITING_RETURN") return invalid(ret.status);
  ret.cancellationReason = text(body.reason) || null;
  ret.closedAt = now();
  move(ret, "CANCELLED", ret.cancellationReason);
  return ok(wire(ret));
}

function propose(ret: MockReturn, body: Record<string, unknown>) {
  if (stale(ret, body)) return optimisticLock();
  if (ret.status !== "RECEIVED") return invalid(ret.status);
  const lines = Array.isArray(body.lines)
    ? (body.lines as { lineId?: string; quantity?: number }[])
    : [];
  for (const l of ret.lines) {
    const cap = Math.min(l.approvedQuantity ?? 0, l.receivedQuantity ?? 0);
    const qty = lines.find((x) => x.lineId === l.id)?.quantity ?? cap;
    if (qty < 0 || qty > cap)
      return fail(400, "RETURN_QUANTITIES_INVALID", "Refund at most approved and back");
    l.refundQuantity = qty;
    l.refundAmount = Math.round(qty * l.unitPrice * (1 + VAT));
  }
  const amount = ret.lines.reduce((sum, l) => sum + (l.refundAmount ?? 0), 0);
  if (amount <= 0) return fail(400, "RETURN_QUANTITIES_INVALID", "Refund at least one unit");
  ret.resolution = {
    moneyMode: "REFUND",
    settlementAmount: amount,
    proposedBy: "mock-current-user",
    proposedAt: now(),
    note: text(body.note) || null,
    vatAdjustmentRequired: true,
  };
  move(ret, "SETTLEMENT_PENDING");
  return ok(wire(ret));
}

function settle(ret: MockReturn, body: Record<string, unknown>, approved: boolean) {
  if (stale(ret, body)) return optimisticLock();
  if (ret.status !== "SETTLEMENT_PENDING") return invalid(ret.status);
  if (ret.resolution?.proposedBy === "mock-current-user")
    return fail(409, "RETURN_SELF_APPROVAL", "The proposer cannot approve");
  if (!approved) {
    const reason = text(body.reason);
    if (!reason)
      return fail(400, "VALIDATION_FAILED", "reason is required", [
        { field: "reason", message: "required" },
      ]);
    ret.resolution = null;
    move(ret, "RECEIVED", reason);
    return ok(wire(ret));
  }
  const amount = Number(ret.resolution?.settlementAmount ?? 0);
  ret.resolution = {
    ...ret.resolution,
    settledBy: "mock-current-user",
    settledAt: now(),
    offsetAmount: 0,
    refundedAmount: amount,
  };
  ret.closedAt = now();
  move(ret, "RESOLVED");
  return ok(wire(ret));
}

async function open(orderId: string, body: Record<string, unknown>) {
  const requestId = text(body.requestId);
  const replay = mockReturns().find((r) => r.id === `RMA-${requestId}`);
  if (replay) return ok(wire(replay), 201);
  const { orders } = await import("@/lib/mock-data");
  const order = orders.find((o) => o.orderId === orderId);
  if (!order) return fail(404, "NOT_FOUND", `No order ${orderId}`);
  const reason = text(body.reasonCode) as ReturnReason;
  if (reason === "SHORT_DELIVERY" || reason === "CHANGED_MIND")
    return fail(409, "RETURN_REASON_NOT_ACCEPTED", "Not accepted");
  if (reason === "OTHER" && !text(body.description))
    return fail(400, "VALIDATION_FAILED", "A return for OTHER must describe the problem");
  const claims = Array.isArray(body.lines)
    ? (body.lines as { orderLineId?: string; quantity?: number }[])
    : [];
  if (!claims.length) return fail(400, "RETURN_QUANTITIES_INVALID", "Claim at least one line");
  const lines = [];
  for (const claim of claims) {
    const orderLine = order.lines.find((l) => l.lineId === claim.orderLineId);
    if (!orderLine || !claim.quantity || claim.quantity < 1)
      return fail(400, "RETURN_QUANTITIES_INVALID", "Invalid line");
    if (claim.quantity > orderLine.quantity)
      return fail(409, "RETURN_QUANTITY_EXCEEDED", "More than delivered");
    lines.push({
      id: nextMockReturnId("RL"),
      orderLineId: orderLine.lineId,
      sku: orderLine.skuId,
      customPrinted: !!orderLine.designId,
      unitPrice: orderLine.unitPrice,
      requestedQuantity: claim.quantity,
      approvedQuantity: null,
      receivedQuantity: null,
      refundQuantity: 0,
      refundAmount: null,
    });
  }
  const created: MockReturn = {
    id: requestId ? `RMA-${requestId}` : nextMockReturnId("RMA"),
    rmaNumber: `RMA-${now().slice(0, 10).replaceAll("-", "")}-${String(mockReturns().length + 1).padStart(4, "0")}`,
    orderId,
    orderNumber: order.orderNumber,
    customerId: mockCustomerUuid(order.customerId),
    warehouseId: MOCK_RETURN_WAREHOUSE,
    status: "REQUESTED",
    reasonCode: reason,
    description: text(body.description) || null,
    channel: "BACK_OFFICE",
    requestedBy: "mock-current-user",
    requestedAt: now(),
    lateClaimReason: text(body.lateClaimReason) || null,
    currency: order.currency,
    review: null,
    receipt: null,
    resolution: null,
    cancellationReason: null,
    closedAt: null,
    lines,
    evidence: [],
    history: [{ from: null, to: "REQUESTED", reason, occurredAt: now() }],
    version: 0,
  };
  mockReturns().unshift(created);
  return ok(wire(created), 201);
}

export function registerReturnMockRoutes(): void {
  registerMockRoute("GET", "/returns", (config) => list(queryOf(config)));
  registerMockRoute("GET", "/returns/:id", (config) => {
    const ret = byId(pathParams(config).id ?? "");
    return ret ? ok(wire(ret)) : notFound(pathParams(config).id ?? "");
  });
  registerMockRoute("GET", "/returns/:id/evidence/:evidenceId/download-url", () =>
    ok({ url: "/file.svg" }),
  );
  registerMockRoute("POST", "/orders/:orderId/returns", (config) =>
    open(pathParams(config).orderId ?? "", bodyOf(config)),
  );
  const step =
    (fn: (ret: MockReturn, body: Record<string, unknown>) => ReturnType<typeof ok>) =>
    (config: Parameters<typeof bodyOf>[0]) => {
      const id = pathParams(config).id ?? "";
      const ret = byId(id);
      return ret ? fn(ret, bodyOf(config)) : notFound(id);
    };
  registerMockRoute("POST", "/returns/:id/approval", step(approve));
  registerMockRoute("POST", "/returns/:id/rejection", step(reject));
  registerMockRoute("POST", "/returns/:id/cancellation", step(cancel));
  registerMockRoute("POST", "/returns/:id/resolution", step(propose));
  registerMockRoute(
    "POST",
    "/returns/:id/settlement-approval",
    step((r, b) => settle(r, b, true)),
  );
  registerMockRoute(
    "POST",
    "/returns/:id/settlement-rejection",
    step((r, b) => settle(r, b, false)),
  );
}
