/**
 * Mock routes — yêu cầu trả hàng (BE `ReturnRequestController` + `ReturnResolutionController`, docs 17 §4.10):
 *   GET  /returns?status&orderId&customerId&search&vatAdjustment   hàng đợi back-office
 *   GET  /returns/{id}                                             chi tiết (ảnh, phiếu nhập, hoàn tiền, lịch sử)
 *   GET  /returns/{id}/evidence/{evidenceId}/download-url          link ảnh 5 phút
 *   POST /orders/{orderId}/returns                                 Sale mở thay khách (idempotent theo requestId)
 *   POST /returns/{id}/approval | rejection | cancellation         Sale duyệt / từ chối / rút
 *   POST /returns/{id}/resolution                                  Sale đề xuất hoàn tiền (RECEIVED)
 *   POST /returns/{id}/settlement-approval | settlement-rejection  Kế toán duyệt / trả lại (SETTLEMENT_PENDING)
 *   POST /returns/{id}/goods-complete                              WF-05 TH-3: chốt theo số đã về (AWAITING_RETURN)
 *   POST /returns/{id}/closure-without-refund                      WF-05 TH-4: kết thúc không hoàn tiền (RECEIVED)
 *   POST /returns/{id}/evidence/uploads → PUT /__mock-storage/returns/{uploadId} → POST /returns/{id}/evidence
 *                                                                  ảnh bằng chứng tải thẳng lên kho (CLAIM)
 * Kiểm `version` như BE (409 OPTIMISTIC_LOCK), trạng thái nguồn (409 RETURN_INVALID_TRANSITION) và trần số lượng.
 */

import { RETURN_LIMITS, RETURN_REFUSAL_REASONS } from "@/constants/returns";

import { registerMockRoute } from "./mock-adapter";
import { custodyChoiceRefusal, registerCustomerCustodyMockRoutes } from "./mock-customer-custody";
import {
  mockReceiptDraftOpen,
  mockReceiptOpenable,
  mockReturns,
  nextMockReturnId,
  MOCK_RETURN_WAREHOUSE,
} from "./mock-returns-store";
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
  validationFailed,
} from "./mock-route-utils";

import type { ReturnApiStatus, ReturnReason } from "@/constants/returns";
import type { MockCustody, MockReturn } from "./mock-returns-store";

const now = () => new Date().toISOString();
const byId = (id: string) => mockReturns().find((r) => r.id === id);
const notFound = (id: string) => fail(404, "RETURN_REQUEST_NOT_FOUND", `No return request ${id}`);
const invalid = (status: string) =>
  fail(409, "RETURN_INVALID_TRANSITION", `Not allowed from ${status}`);

const VAT = 0.08;

/**
 * WF-05 F-20 (mock, như BE G4 `ReturnRequest.outcomeOf`): kết quả của yêu cầu đã xử lý xong — theo đơn vị được hoàn, không
 * theo số tiền; không hoàn đơn vị nào thì không bao giờ là REFUNDED.
 */
function outcomeOf(ret: MockReturn): string | null {
  if (ret.status !== "RESOLVED") return null;
  if (ret.lines.some((l) => l.refundQuantity > 0)) return "REFUNDED";
  return ret.refusalReason ? "REFUSED" : "NOTHING_TO_REFUND";
}

function wire(ret: MockReturn) {
  const { warehouseId: _warehouse, ...rest } = ret;
  void _warehouse;
  return {
    ...rest,
    discrepancies: [],
    history: ret.history.map((h) => ({ ...h, actorId: null })),
    outcome: outcomeOf(ret),
    receiptOpenable: mockReceiptOpenable(ret),
    receiptDraftOpen: mockReceiptDraftOpen(ret),
    custodyChoice: ret.custodyChoice ?? null,
    custodyChoiceNote: ret.custodyChoiceNote ?? null,
    custodyChoiceBy: ret.custodyChoiceBy ?? null,
    custodyChoiceAt: ret.custodyChoiceAt ?? null,
  };
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
    receiptOpenable: mockReceiptOpenable(ret),
    receiptDraftOpen: mockReceiptDraftOpen(ret),
    outcome: outcomeOf(ret),
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

/** Đã có kiện hàng về (BE `ReturnRequest.anyParcel`). */
const anyParcel = (ret: MockReturn) =>
  !!ret.receipt?.goodsReceiptId || (ret.receipt?.parcels.length ?? 0) > 0;

function cancel(ret: MockReturn, body: Record<string, unknown>) {
  if (ret.status !== "REQUESTED" && ret.status !== "AWAITING_RETURN") return invalid(ret.status);
  // WF-05 TH-3: rút sẽ bỏ hàng đã về trong kho mà không hoàn gì
  if (anyParcel(ret))
    return fail(409, "RETURN_GOODS_PARTLY_RECEIVED", "A parcel came back: mark the goods complete");
  // BE-23 / audit r2 M-3: kho đang đếm một kiện trên phiếu nháp
  const counting = draftCounting(ret);
  if (counting) return counting;
  ret.cancellationReason = text(body.reason) || null;
  ret.closedAt = now();
  move(ret, "CANCELLED", ret.cancellationReason);
  return ok(wire(ret));
}

/** WF-05 Q-4 (audit r2 returns H1): Sale ghi lựa chọn của khách cho hàng giữ hộ. */
function recordCustodyChoice(ret: MockReturn, body: Record<string, unknown>) {
  if (stale(ret, body)) return optimisticLock();
  const refusal = custodyChoiceRefusal(ret);
  if (refusal) return refusal;
  const choice = text(body.choice);
  if (choice !== "SEND_BACK" && choice !== "DESTROY_ON_BEHALF")
    return validationFailed("choice", "choice is required");
  const note = text(body.note) || null;
  if (choice === "DESTROY_ON_BEHALF" && !note)
    return validationFailed("note", "A destruction names the customer's consent");
  Object.assign(ret, {
    custodyChoice: choice,
    custodyChoiceNote: note,
    custodyChoiceBy: "mock-current-user",
    custodyChoiceAt: now(),
    version: ret.version + 1,
  });
  return ok(wire(ret));
}

/** Số đơn vị hoàn được (BE `ReturnLine.refundableUnits`). */
const refundable = (ret: MockReturn) =>
  ret.lines.reduce((sum, l) => sum + Math.min(l.approvedQuantity ?? 0, l.receivedQuantity ?? 0), 0);

/** WF-05 BE-23 (mock): kho đang đếm một kiện của yêu cầu trên phiếu nháp. */
const draftCounting = (ret: MockReturn) =>
  mockReceiptDraftOpen(ret)
    ? fail(409, "RETURN_RECEIPT_DRAFT_OPEN", "A draft return receipt is open")
    : null;

function propose(ret: MockReturn, body: Record<string, unknown>) {
  if (stale(ret, body)) return optimisticLock();
  if (ret.status !== "RECEIVED") return invalid(ret.status);
  const counting = draftCounting(ret);
  if (counting) return counting;
  const lines = Array.isArray(body.lines)
    ? (body.lines as { lineId?: string; quantity?: number }[])
    : [];
  // Không còn đơn vị nào hoàn được: kết thúc không hoàn tiền, không phải đề xuất (TH-4)
  if (refundable(ret) === 0)
    return fail(400, "RETURN_QUANTITIES_INVALID", "Nothing refundable: close without refund");
  const quantities = new Map<string, number>();
  for (const l of ret.lines) {
    const cap = Math.min(l.approvedQuantity ?? 0, l.receivedQuantity ?? 0);
    const qty = lines.find((x) => x.lineId === l.id)?.quantity ?? cap;
    if (qty < 0 || qty > cap)
      return fail(400, "RETURN_QUANTITIES_INVALID", "Refund at most approved and back");
    quantities.set(l.id, qty);
  }
  // WF-05 Q-4 (BE-12, như BE G4 `ReturnRequest.proposeRefund`): không hoàn đơn vị nào → lý do bắt buộc; giữ lại một phần →
  // lý do tuỳ chọn; hoàn đủ → không lý do; OTHER → ghi chú gửi khách bắt buộc; ghi chú chỉ đi kèm lý do
  const total = [...quantities.values()].reduce((sum, qty) => sum + qty, 0);
  const reason = text(body.refusalReason);
  if (total === 0 && !reason)
    return fail(400, "RETURN_REFUSAL_REASON_REQUIRED", "Name why nothing is refunded");
  if (reason && !(RETURN_REFUSAL_REASONS as readonly string[]).includes(reason))
    return validationFailed("refusalReason", "Unknown refusal reason");
  const refusalNote = text(body.refusalNote);
  if (refusalNote.length > RETURN_LIMITS.refusalNoteMax)
    return validationFailed("refusalNote", "refusalNote is at most 500 characters");
  if (!reason && refusalNote)
    return validationFailed("refusalNote", "A note for the customer goes with a refusal reason");
  if (reason && total === refundable(ret))
    return validationFailed(
      "refusalReason",
      "Every unit is refunded: nothing to give a reason for",
    );
  if (reason === "OTHER" && !refusalNote)
    return validationFailed("refusalNote", "A refusal for another reason says what it is");
  for (const l of ret.lines) {
    const qty = quantities.get(l.id) ?? 0;
    l.refundQuantity = qty;
    l.refundAmount = Math.round(qty * l.unitPrice * (1 + VAT));
  }
  const amount = ret.lines.reduce((sum, l) => sum + (l.refundAmount ?? 0), 0);
  ret.refusalReason = reason || null;
  ret.refusalNote = reason ? refusalNote || null : null;
  ret.resolution = {
    moneyMode: amount > 0 ? "REFUND" : null,
    settlementAmount: amount,
    proposedBy: "mock-current-user",
    proposedAt: now(),
    note: text(body.note) || null,
    vatAdjustmentRequired: amount > 0,
  };
  move(ret, "SETTLEMENT_PENDING");
  return ok(wire(ret));
}

/** WF-05 TH-3 (BE `ReturnRequest.markGoodsComplete`): AWAITING_RETURN có ≥ 1 kiện về → RECEIVED. */
function goodsComplete(ret: MockReturn, body: Record<string, unknown>) {
  if (stale(ret, body)) return optimisticLock();
  if (ret.status !== "AWAITING_RETURN" || !anyParcel(ret)) return invalid(ret.status);
  // WF-05 BE-23: còn phiếu nháp đang đếm thì chưa chốt
  if (mockReceiptDraftOpen(ret))
    return fail(409, "RETURN_RECEIPT_DRAFT_OPEN", "A draft return receipt is open");
  const note = text(body.note);
  if (note.length > RETURN_LIMITS.goodsCompleteNoteMax)
    return validationFailed("note", "note is at most 500 characters");
  move(ret, "RECEIVED", note ? `GOODS_COMPLETE: ${note}` : "GOODS_COMPLETE");
  return ok(wire(ret));
}

/** WF-05 TH-4 (BE `ReturnRequest.closeWithoutRefund`): RECEIVED, không đơn vị nào hoàn được → RESOLVED, 0 đồng. */
function closeWithoutRefund(ret: MockReturn, body: Record<string, unknown>) {
  if (stale(ret, body)) return optimisticLock();
  if (ret.status !== "RECEIVED") return invalid(ret.status);
  const counting = draftCounting(ret);
  if (counting) return counting;
  if (refundable(ret) > 0)
    return fail(400, "RETURN_QUANTITIES_INVALID", "Units approved came back: propose their refund");
  const note = text(body.note);
  if (note.length > RETURN_LIMITS.noteMax)
    return validationFailed("note", "note is at most 1000 characters");
  for (const l of ret.lines) {
    l.refundQuantity = 0;
    l.refundAmount = 0;
  }
  ret.resolution = {
    moneyMode: null,
    settlementAmount: 0,
    proposedBy: "mock-current-user",
    proposedAt: now(),
    note: note || null,
    settledBy: "mock-current-user",
    settledAt: now(),
    offsetAmount: 0,
    refundedAmount: 0,
    vatAdjustmentRequired: false,
  };
  ret.closedAt = now();
  move(ret, "RESOLVED", "RESOLVED_NOTHING_USABLE");
  return ok(wire(ret));
}

/* ── Ảnh bằng chứng tải thẳng lên kho (BE `beginEvidenceUpload` / `addUploadedEvidence`) ───────────── */

interface MockEvidenceUpload {
  returnId: string;
  /** CLAIM (ảnh khiếu nại) hoặc CUSTODY (biên nhận giữ hộ, WF-05 Q-11). */
  stage: string;
  fileName: string;
  received: boolean;
  evidenceId: string | null;
}
const evidenceUploads = new Map<string, MockEvidenceUpload>();

/**
 * BE G4 `requireEvidenceAllowed`: ảnh khiếu nại chỉ khi còn chờ duyệt / chờ hàng về; biên nhận giữ hộ (WF-05 Q-11) ở mọi
 * trạng thái; tối đa 10 ảnh MỖI bước.
 */
function evidenceRefusal(ret: MockReturn, stage: string) {
  if (stage === "CLAIM" && ret.status !== "REQUESTED" && ret.status !== "AWAITING_RETURN")
    return invalid(ret.status);
  if (ret.evidence.filter((e) => e.stage === stage).length >= RETURN_LIMITS.evidenceMax)
    return fail(409, "RETURN_EVIDENCE_LIMIT_REACHED", "The return holds its photos already");
  return null;
}

function beginEvidenceUpload(ret: MockReturn, body: Record<string, unknown>, stage = "CLAIM") {
  const fileName = text(body.fileName);
  const contentType = text(body.contentType);
  const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : 0;
  // UploadSlotRequest: fileName ≤ 255, contentType ≤ 100, sizeBytes > 0, sha256 hex thường 64
  if (!fileName || fileName.length > 255)
    return validationFailed("fileName", "fileName is required");
  if (!contentType || contentType.length > 100)
    return validationFailed("contentType", "contentType is required");
  if (!(sizeBytes > 0)) return validationFailed("sizeBytes", "sizeBytes must be positive");
  if (!/^[0-9a-f]{64}$/.test(text(body.sha256)))
    return validationFailed("sha256", "must be a lower-case hex SHA-256");
  const refused = evidenceRefusal(ret, stage);
  if (refused) return refused;
  if (!(RETURN_LIMITS.evidenceTypes as readonly string[]).includes(contentType))
    return fail(415, "UNSUPPORTED_MEDIA_TYPE", "This file type is not accepted");
  if (sizeBytes > RETURN_LIMITS.evidenceMaxBytes)
    return fail(413, "PAYLOAD_TOO_LARGE", "The uploaded file is too large");
  const uploadId = crypto.randomUUID();
  evidenceUploads.set(uploadId, {
    returnId: ret.id,
    stage,
    fileName,
    received: false,
    evidenceId: null,
  });
  return ok(
    {
      uploadId,
      method: "PUT",
      url: `/__mock-storage/returns/${uploadId}`,
      headers: { "Content-Type": contentType },
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    },
    201,
  );
}

function attachEvidence(ret: MockReturn, body: Record<string, unknown>, stage = "CLAIM") {
  const uploadId = text(body.uploadId);
  const upload = evidenceUploads.get(uploadId);
  if (!upload || upload.returnId !== ret.id || upload.stage !== stage)
    return validationFailed("uploadId", "No such upload for this return");
  // Gửi lại cùng uploadId → trả yêu cầu như đã gắn
  if (upload.evidenceId) return ok(wire(ret), 201);
  if (!upload.received) return validationFailed("uploadId", "The file was never uploaded");
  // Biên nhận giữ hộ (BE G4 `ReturnEvidence.Custody`): SKU hoặc LPN, ≥ 1 đơn vị
  let custody: MockCustody | undefined;
  if (stage === "CUSTODY") {
    const sku = text(body.sku);
    const lpn = text(body.lpn);
    const quantity = typeof body.quantity === "number" ? body.quantity : 0;
    if (!sku && !lpn) return validationFailed("sku", "Name the goods by their SKU or their LPN");
    if (!Number.isInteger(quantity) || quantity < 1)
      return validationFailed("quantity", "At least one unit");
    custody = { sku: sku || null, lpn: lpn || null, quantity, note: text(body.note) || null };
  }
  const refused = evidenceRefusal(ret, stage);
  if (refused) return refused;
  const evidenceId = nextMockReturnId("EV");
  ret.evidence.push({
    id: evidenceId,
    stage,
    originalName: upload.fileName,
    uploadedAt: now(),
    ...(custody ? { custody } : {}),
  });
  upload.evidenceId = evidenceId;
  ret.version += 1;
  return ok(wire(ret), 201);
}

function settle(ret: MockReturn, body: Record<string, unknown>, approved: boolean) {
  if (stale(ret, body)) return optimisticLock();
  if (ret.status !== "SETTLEMENT_PENDING") return invalid(ret.status);
  if (ret.resolution?.proposedBy === "mock-current-user")
    return fail(409, "RETURN_SELF_APPROVAL", "The proposer cannot approve");
  const counting = approved ? draftCounting(ret) : null;
  if (counting) return counting;
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
  registerMockRoute("POST", "/returns/:id/goods-complete", step(goodsComplete));
  registerMockRoute("POST", "/returns/:id/closure-without-refund", step(closeWithoutRefund));
  registerMockRoute("POST", "/returns/:id/custody-choice", step(recordCustodyChoice));
  registerCustomerCustodyMockRoutes();
  // `/evidence/uploads` trước `/evidence` không cần (khác số đoạn) — giữ cạnh nhau cho dễ đọc
  registerMockRoute("POST", "/returns/:id/evidence/uploads", step(beginEvidenceUpload));
  registerMockRoute("POST", "/returns/:id/evidence", step(attachEvidence));
  // WF-05 Q-11: biên nhận giữ hộ — cùng kho ảnh, stage CUSTODY
  registerMockRoute(
    "POST",
    "/returns/:id/custody/uploads",
    step((r, b) => beginEvidenceUpload(r, b, "CUSTODY")),
  );
  registerMockRoute(
    "POST",
    "/returns/:id/custody",
    step((r, b) => attachEvidence(r, b, "CUSTODY")),
  );
  // Kho đối tượng của ảnh trả hàng: nhận byte rồi đánh dấu đã tới (URL ký sẵn, không xác thực)
  registerMockRoute("PUT", "/__mock-storage/returns/:uploadId", (config) => {
    const upload = evidenceUploads.get(pathParams(config).uploadId ?? "");
    if (!upload) return fail(403, "SIGNATURE_MISMATCH", "Request signature does not match");
    upload.received = true;
    return { status: 200, data: null, headers: {} };
  });
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
