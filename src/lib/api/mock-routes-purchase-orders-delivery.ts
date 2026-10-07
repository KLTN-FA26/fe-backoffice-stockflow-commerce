/**
 * Mock routes — giao tiếp NCC của PO (BE #36 `PurchaseOrderController` + `PurchaseOrderDeliveryController`):
 * gửi NCC (`/sending`), khôi phục gửi (`/delivery-recovery`), ghi nhận NCC phản hồi
 * (`/supplier-confirmation`) và lịch sử gửi (`GET /deliveries`). Luật lấy đúng từ
 * `PurchaseOrder#confirmDeliveryDate / requireDeliveryRecovery / recordSupplierConfirmation`.
 */

import { registerMockRoute } from "./mock-adapter";
import {
  BE_DEFAULT_PAGE_SIZE,
  BE_PO_TRANSITIONS,
  MOCK_PO_ACTOR,
  addDecision,
  catalogNameForSku,
  beError,
  beOk,
  bePage,
  getDecisions,
  getDeliveries,
  getPoStore,
  invalidTransition,
  notFound,
  parseJsonBody,
  readInt,
  readParams,
  readRouteId,
  queueOutbox,
  readString,
  suppressQueuedDelivery,
  todayVn,
  touch,
} from "./mock-routes-purchase-orders-store";
import { findMockSupplier } from "./mock-routes-suppliers";

import type { AxiosRequestConfig } from "axios";
import type { MockBePo } from "./mock-routes-purchase-orders-store";

const MAX_REASON = 1000;

/** BE #36 (9fbb90f) `PurchaseOrder#requireRecoveryReason` → BusinessException, không có field. */
function reasonError() {
  return beError(400, "PO_REASON_REQUIRED", "A reason of 1..1000 characters is required");
}

function conflict(message: string) {
  return beError(409, "CONFLICT", message);
}

interface DecisionInput {
  previousExpectedAt: string | null;
  expectedAt: string | null;
  reason: string | null;
  reconciled: boolean;
  acknowledgePastDue: boolean;
}

/**
 * Ghi quyết định gửi + một lần gửi mới (BE `publishDelivery`: decision + outbox → notification).
 * Mock coi lần gửi đang vào hàng đợi.
 */
async function queueDelivery(po: MockBePo, decision: DecisionInput) {
  const supplier = await findMockSupplier(po.supplierId);
  if (!supplier || supplier.status !== "ACTIVE") {
    return conflict("An active supplier with a delivery contact is required");
  }
  // BE NotificationServiceImpl.prepareSupplierDelivery: gửi lần đầu = generation 0,
  // mỗi lần khôi phục gửi +1.
  const generation = getDeliveries(po.purchaseOrderId)
    .filter((d) => d.templateCode === "purchase-order.sent")
    .reduce((m, d) => Math.max(m, d.generation + 1), 0);
  const now = new Date().toISOString();
  addDecision(po.purchaseOrderId, {
    id: crypto.randomUUID(),
    generation,
    ...decision,
    channel: "EMAIL",
    recipient: supplier.code,
    actor: MOCK_PO_ACTOR,
    requestedAt: now,
  });
  // Chưa có dòng lần gửi: BE chỉ ghi lịch sử sau khi worker gửi xong (SENT / FAILED).
  queueOutbox(po.purchaseOrderId, {
    channel: "EMAIL",
    recipient: supplier.code,
    generation,
    templateCode: "purchase-order.sent",
  });
  return null;
}

/** POST /{id}/sending — body tuỳ chọn `{ expectedAt, reason }` (UPDATE). */
async function send(config: AxiosRequestConfig) {
  const id = readRouteId(config);
  const store = await getPoStore();
  const po = store.get(id);
  if (!po) return notFound(id);
  if (!BE_PO_TRANSITIONS[po.status].includes("SENT")) {
    return invalidTransition(`Purchase order ${id} cannot move from ${po.status} to SENT`);
  }
  const body = parseJsonBody(config.data);
  const replacement = readString(body.expectedAt) || null;
  const reason = readString(body.reason);
  const candidate = replacement ?? po.expectedAt;
  // BE confirmDeliveryDate (#36 9fbb90f): ngày giao phải có; ngày đã qua KHÔNG chặn (BR-06).
  if (!candidate) {
    return beError(400, "PO_DELIVERY_DATE_REQUIRED", "A delivery date is required before sending");
  }
  if (replacement && replacement !== po.expectedAt && (!reason || reason.length > MAX_REASON)) {
    return reasonError();
  }
  // BE ProcurementServiceImpl#description: mô tả dòng, thiếu thì tên theo SKU trong danh mục.
  for (const line of po.lines) {
    if (!line.description?.trim() && !(await catalogNameForSku(line.sku))) {
      return beError(
        400,
        "PO_LINE_DESCRIPTION_REQUIRED",
        `Missing product description for SKU ${line.sku}`,
      );
    }
  }
  const queued = await queueDelivery(po, {
    previousExpectedAt: po.expectedAt,
    expectedAt: candidate,
    reason: reason || null,
    reconciled: false,
    acknowledgePastDue: false,
  });
  if (queued) return queued;
  const updated = touch(po, {
    status: "SENT",
    expectedAt: candidate,
    sentAt: new Date().toISOString(),
    supplierConfirmationStatus: "PENDING",
    deliveryStatus: "QUEUED",
  });
  store.set(id, updated);
  return beOk(updated);
}

/** POST /{id}/delivery-recovery — `{ reason, reconciled, acknowledgePastDue }` (APPROVE). */
async function recoverDelivery(config: AxiosRequestConfig) {
  const id = readRouteId(config);
  const store = await getPoStore();
  const po = store.get(id);
  if (!po) return notFound(id);
  if (po.status !== "SENT" || po.supplierConfirmationStatus !== "PENDING") {
    return invalidTransition("Delivery recovery requires SENT with a pending supplier response");
  }
  const body = parseJsonBody(config.data);
  const reason = readString(body.reason);
  if (!reason || reason.length > MAX_REASON) return reasonError();
  if (body.reconciled !== true)
    return conflict("Reconcile the previous delivery outcome before retrying");
  if ((!po.expectedAt || po.expectedAt < todayVn()) && body.acknowledgePastDue !== true) {
    return conflict("Explicitly acknowledge the original overdue or unknown delivery date");
  }
  const last = getDeliveries(id).find((d) => d.templateCode === "purchase-order.sent");
  if (!last || last.status !== "FAILED") {
    return conflict("Only a delivery that ended in a terminal failure can be recovered");
  }
  const queued = await queueDelivery(po, {
    previousExpectedAt: po.expectedAt,
    expectedAt: po.expectedAt,
    reason,
    reconciled: true,
    acknowledgePastDue: body.acknowledgePastDue === true,
  });
  if (queued) return queued;
  const updated = touch(po, { deliveryStatus: "QUEUED" });
  store.set(id, updated);
  return beOk(updated);
}

/** POST /{id}/supplier-confirmation — `{ status: CONFIRMED|REJECTED, supplierReference, note }` (UPDATE). */
async function recordConfirmation(config: AxiosRequestConfig) {
  const id = readRouteId(config);
  const store = await getPoStore();
  const po = store.get(id);
  if (!po) return notFound(id);
  const body = parseJsonBody(config.data);
  const response = readString(body.status);
  const reference = readString(body.supplierReference) || null;
  const note = readString(body.note) || null;
  if (response !== "CONFIRMED" && response !== "REJECTED") {
    return beError(
      400,
      "PO_SUPPLIER_RESPONSE_INVALID",
      "Supplier response must be CONFIRMED or REJECTED",
    );
  }
  if (response === "REJECTED" && !note) return reasonError();
  if (!["SENT", "PARTIALLY_RECEIVED", "CLOSED", "CLOSED_SHORT"].includes(po.status)) {
    return invalidTransition("A supplier response needs a purchase order that has been sent");
  }
  if (response === "REJECTED" && po.status !== "SENT") {
    return invalidTransition("Cannot reject a purchase order after receipt");
  }
  if (po.supplierConfirmationStatus === response) {
    if (po.supplierReference === reference && po.supplierResponseNote === note) return beOk(po);
    return invalidTransition("A recorded supplier response cannot be overwritten");
  }
  if (po.supplierConfirmationStatus !== "PENDING") {
    return invalidTransition("supplier response is already final");
  }
  // BE recordSupplierConfirmation → suppressSupplierDelivery: NCC đã phản hồi thì không gửi nữa.
  const updated = touch(po, {
    ...suppressQueuedDelivery(po),
    supplierConfirmationStatus: response,
    supplierRespondedAt: new Date().toISOString(),
    supplierReference: reference,
    supplierResponseNote: note,
  });
  store.set(id, updated);
  return beOk(updated);
}

export function registerPoDeliveryMockRoutes(): void {
  registerMockRoute("POST", "/purchase-orders/:id/sending", send);
  registerMockRoute("POST", "/purchase-orders/:id/delivery-recovery", recoverDelivery);
  registerMockRoute("POST", "/purchase-orders/:id/supplier-confirmation", recordConfirmation);
  // GET /{id}/deliveries — mới nhất trước (BE sắp theo createdAt, id giảm dần).
  registerMockRoute("GET", "/purchase-orders/:id/deliveries", async (config) => {
    const id = readRouteId(config);
    if (!(await getPoStore()).has(id)) return notFound(id);
    const p = readParams(config);
    return beOk(
      bePage(getDeliveries(id), readInt(p.page, 0), readInt(p.size, BE_DEFAULT_PAGE_SIZE)),
    );
  });
  // GET /{id}/delivery-decisions — ai cho phép gửi / khôi phục, mới nhất trước.
  registerMockRoute("GET", "/purchase-orders/:id/delivery-decisions", async (config) => {
    const id = readRouteId(config);
    if (!(await getPoStore()).has(id)) return notFound(id);
    const p = readParams(config);
    return beOk(
      bePage(getDecisions(id), readInt(p.page, 0), readInt(p.size, BE_DEFAULT_PAGE_SIZE)),
    );
  });
}
