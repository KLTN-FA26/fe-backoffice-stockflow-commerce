/**
 * Mock PO — store in-memory + kiểu wire + helper dùng chung cho
 * `mock-routes-purchase-orders.ts` (CRUD/báo cáo/nhận hàng) và
 * `mock-routes-purchase-orders-delivery.ts` (gửi NCC, khôi phục, NCC xác nhận).
 *
 * Wire shape = BE `PurchaseOrderResponse` / `POLineResponse` / `DeliveryAttemptResponse`
 * (nhánh BE `test`: #36 + #39 + #40). Lỗi = envelope BE
 * `{ success:false, errorCode, message, fieldErrors:[{field,message}] }`.
 */

import { findMockSupplier } from "./mock-routes-suppliers";

import type { AxiosRequestConfig } from "axios";
import type { PoStatus, PurchaseOrder } from "@/lib/mock-data";

/** BE `PurchaseOrderStatus.java` — 8 trạng thái D4 (BE PR #71). */
export const BE_PO_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "CONFIRMED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CLOSED",
  "CANCELLED",
] as const;
export type BePoStatus = (typeof BE_PO_STATUSES)[number];
export type ConfirmationStatus = "NOT_SENT" | "PENDING" | "CONFIRMED" | "REJECTED";
export type PoDeliveryStatus =
  "NOT_SENT" | "QUEUED" | "RETRYING" | "FAILED" | "DELIVERED" | "SUPPRESSED";

/**
 * Seed `mock-data.ts` dùng từ vựng Title Case của docs 02 (không được sửa file seed). Đây là
 * chỗ DUY NHẤT dịch sang mã BE — BE D4 (PR #71) có đủ các bước nên ánh xạ một-một.
 */
const LEGACY_PO_STATUS: Record<PoStatus, BePoStatus> = {
  Draft: "DRAFT",
  "Pending Approval": "PENDING_APPROVAL",
  Approved: "APPROVED",
  Confirmed: "CONFIRMED",
  "Partially Received": "PARTIALLY_RECEIVED",
  Received: "RECEIVED",
  Closed: "CLOSED",
  Cancelled: "CANCELLED",
};

/** BE `PurchaseOrderStatus#canTransitionTo` (D4). */
export const BE_PO_TRANSITIONS: Record<BePoStatus, readonly BePoStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "DRAFT", "CANCELLED"],
  APPROVED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CANCELLED"],
  PARTIALLY_RECEIVED: ["CLOSED"],
  RECEIVED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

export const BE_MAX_PAGE_SIZE = 200;
export const BE_DEFAULT_PAGE_SIZE = 20;
/** BE `ErrorCode.VALIDATION_FAILED` — câu chung khi lỗi đến từ IllegalArgumentException. */
export const BE_GENERIC_VALIDATION_MESSAGE = "Invalid request data";
export const MOCK_PO_ACTOR = "mock-user";

export interface MockBePoLine {
  lineId: string;
  lineNo: number;
  inventoryItemId: string;
  sku: string;
  description: string | null;
  uom: string;
  quantityOrdered: number;
  quantityReceived: number;
  openQuantity: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
  status: "OPEN" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CLOSED" | "CANCELLED";
}

export interface MockBePo {
  purchaseOrderId: string;
  poNumber: string;
  type: "STANDARD" | "SUBCONTRACT";
  productionOrderId: string | null;
  supplierId: string;
  supplierCode: string | null;
  supplierName: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  warehouseName: string | null;
  status: BePoStatus;
  currency: string;
  orderDate: string;
  subtotal: number;
  taxTotal: number;
  totalAmount: number;
  note: string | null;
  expectedAt: string | null;
  lines: MockBePoLine[];
  createdAt: string;
  createdBy: string;
  lastModifiedAt: string;
  lastModifiedBy: string;
  possibleDuplicate: boolean;
  revisionNo: number;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  closedAt: string | null;
  closeKind: "NORMAL" | "SHORT_CLOSE" | "FORCE_CLOSE" | null;
  closeReason: string | null;
  cancellationReason: string | null;
  paymentTermDays: number;
  leadTimeDays: number;
  sentAt: string | null;
  supplierConfirmationStatus: ConfirmationStatus;
  supplierRespondedAt: string | null;
  supplierReference: string | null;
  supplierResponseNote: string | null;
  deliveryStatus: PoDeliveryStatus;
  /** BE #36 (9fbb90f): thông báo huỷ tới NCC — NOT_REQUIRED khi huỷ trước lúc gửi. */
  cancellationDeliveryStatus: "NOT_REQUIRED" | "QUEUED" | "DELIVERED";
  /** BE #36: cảnh báo không chặn — tính lại mỗi lần đọc store (`refreshWarnings`). */
  warnings: string[];
}

/** BE `DeliveryAttemptResponse` (status thô của notification: PENDING | SENT | FAILED). */
export interface MockDeliveryAttempt {
  id: string;
  channel: "EMAIL" | "API";
  status: "PENDING" | "SENT" | "FAILED";
  attemptedAt: string;
  sentAt: string | null;
  failure: string | null;
  generation: number;
  recipient: string;
  /** BE #36 (9fbb90f): thư gửi đơn hay thư báo huỷ. */
  templateCode: MockTemplateCode;
}

export type MockTemplateCode = "purchase-order.sent" | "purchase-order.cancelled";

/**
 * Thư đang chờ worker gửi. BE KHÔNG có dòng lần gửi PENDING: `notification_delivery_log` chỉ được
 * ghi sau khi gửi (SENT — `PurchaseOrderNotificationListener`, FAILED — `DeliveryAttemptRecorder`).
 * Nên mock giữ thư chờ ở đây, tới lúc "gửi xong" mới thêm dòng vào lịch sử.
 */
interface MockOutboxEntry {
  channel: "EMAIL" | "API";
  recipient: string;
  generation: number;
  templateCode: MockTemplateCode;
  queuedAt: number;
}

/** BE `PurchaseOrderDeliveryDecisionResponse` — ai cho phép gửi / khôi phục, vì sao. */
export interface MockDeliveryDecision {
  id: string;
  generation: number;
  previousExpectedAt: string | null;
  expectedAt: string | null;
  reason: string | null;
  reconciled: boolean;
  acknowledgePastDue: boolean;
  channel: "EMAIL" | "API";
  recipient: string;
  actor: string;
  requestedAt: string;
}

export interface MockFieldError {
  field: string;
  message: string;
  /** BE `FieldError.code` — tên constraint (NotBlank, Positive…). */
  code?: string;
}

let poStore: Map<string, MockBePo> | null = null;
const deliveryStore = new Map<string, MockDeliveryAttempt[]>();
const decisionStore = new Map<string, MockDeliveryDecision[]>();
const outbox = new Map<string, MockOutboxEntry[]>();

export async function getPoStore(): Promise<Map<string, MockBePo>> {
  if (!poStore) {
    const { purchaseOrders } = await import("@/lib/mock-data");
    const seeded = await Promise.all(purchaseOrders.map(seedToBePo));
    poStore = new Map(seeded.map((po) => [po.purchaseOrderId, po]));
  }
  settleQueuedDeliveries(poStore);
  refreshWarnings(poStore);
  return poStore;
}

/**
 * BE `PurchaseOrderController#response`: `warnings` có DELIVERY_DATE_IN_PAST khi ngày giao trước
 * hôm nay (giờ VN) và PO chưa kết thúc (BR-06 — chỉ cảnh báo).
 */
const TERMINAL_FOR_WARNINGS: readonly BePoStatus[] = ["CANCELLED", "CLOSED", "RECEIVED"];

function refreshWarnings(store: Map<string, MockBePo>): void {
  const today = todayVn();
  for (const [id, po] of store) {
    const past =
      !!po.expectedAt && po.expectedAt < today && !TERMINAL_FOR_WARNINGS.includes(po.status);
    const warnings = past ? ["DELIVERY_DATE_IN_PAST"] : [];
    if (warnings.join() !== po.warnings.join()) store.set(id, { ...po, warnings });
  }
}

/**
 * Mock thời gian "vận chuyển" email/API tới NCC. BE: worker notification gửi bất đồng bộ, log
 * chuyển SENT thì PO báo `deliveryStatus` = DELIVERED (`NotificationServiceImpl`). Mock tính lười
 * mỗi lần đọc store thay vì `setTimeout` để test không phụ thuộc timer.
 */
const MOCK_TRANSPORT_DELAY_MS = 3000;

function settleQueuedDeliveries(store: Map<string, MockBePo>): void {
  const now = Date.now();
  for (const [poId, entries] of outbox) {
    const due = entries.filter((e) => e.queuedAt + MOCK_TRANSPORT_DELAY_MS <= now);
    if (due.length === 0) continue;
    outbox.set(
      poId,
      entries.filter((e) => !due.includes(e)),
    );
    for (const entry of due) {
      const sentAt = new Date(entry.queuedAt + MOCK_TRANSPORT_DELAY_MS).toISOString();
      addDelivery(poId, {
        id: crypto.randomUUID(),
        channel: entry.channel,
        status: "SENT",
        attemptedAt: sentAt,
        sentAt,
        failure: null,
        generation: entry.generation,
        recipient: entry.recipient,
        templateCode: entry.templateCode,
      });
      const po = store.get(poId);
      if (!po) continue;
      // Thư báo huỷ → `cancellationDeliveryStatus`; thư gửi đơn → `deliveryStatus`.
      if (entry.templateCode === "purchase-order.cancelled") {
        if (po.cancellationDeliveryStatus === "QUEUED") {
          store.set(poId, { ...po, cancellationDeliveryStatus: "DELIVERED" });
        }
      } else if (po.deliveryStatus === "QUEUED") {
        store.set(poId, { ...po, deliveryStatus: "DELIVERED" });
      }
    }
  }
}

/** Xếp một thư vào hàng chờ gửi (gửi đơn / khôi phục gửi / báo huỷ). */
export function queueOutbox(poId: string, entry: Omit<MockOutboxEntry, "queuedAt">): void {
  outbox.set(poId, [...(outbox.get(poId) ?? []), { ...entry, queuedAt: Date.now() }]);
}

/**
 * BE `NotificationServiceImpl#suppressSupplierDelivery` (huỷ PO / NCC đã phản hồi): thư gửi đơn
 * đang chờ không gửi nữa → PO `deliveryStatus` SUPPRESSED (nếu chưa gửi thành công).
 */
export function suppressQueuedDelivery(po: MockBePo): Partial<MockBePo> {
  const entries = outbox.get(po.purchaseOrderId) ?? [];
  const pending = entries.filter((e) => e.templateCode === "purchase-order.sent");
  if (pending.length === 0) return {};
  outbox.set(
    po.purchaseOrderId,
    entries.filter((e) => !pending.includes(e)),
  );
  return po.deliveryStatus === "QUEUED" || po.deliveryStatus === "RETRYING"
    ? { deliveryStatus: "SUPPRESSED" }
    : {};
}

/**
 * Giả lập BE `ProductService#nameForSku`: tên hiển thị của SKU trong danh mục, không có → null.
 * BE dùng làm mô tả dòng khi gửi NCC nếu dòng không có mô tả (#36 9fbb90f).
 */
export async function catalogNameForSku(sku: string): Promise<string | null> {
  const { skus } = await import("@/lib/mock-data");
  return skus.find((s) => s.skuId === sku)?.variantLabel ?? null;
}

export function getDeliveries(poId: string): MockDeliveryAttempt[] {
  return deliveryStore.get(poId) ?? [];
}

export function addDelivery(poId: string, attempt: MockDeliveryAttempt): void {
  deliveryStore.set(poId, [attempt, ...getDeliveries(poId)]);
}

/** Quyết định gửi, mới nhất trước (BE sắp theo requested_at, id giảm dần). */
export function getDecisions(poId: string): MockDeliveryDecision[] {
  return decisionStore.get(poId) ?? [];
}

export function addDecision(poId: string, decision: MockDeliveryDecision): void {
  decisionStore.set(poId, [decision, ...getDecisions(poId)]);
}

/** Chỉ dùng trong test: đưa store về dữ liệu gốc. */
export function resetPoMockStore(): void {
  poStore = null;
  deliveryStore.clear();
  decisionStore.clear();
  outbox.clear();
}

async function seedToBePo(po: PurchaseOrder): Promise<MockBePo> {
  const status = LEGACY_PO_STATUS[po.status];
  const lines: MockBePoLine[] = po.lines.map((l, i) => ({
    lineId: l.lineId,
    lineNo: i + 1,
    inventoryItemId: `item-${l.skuId}`,
    sku: l.skuId,
    description: null,
    uom: "EACH",
    quantityOrdered: l.orderedQty,
    quantityReceived: l.receivedQty,
    openQuantity: Math.max(0, l.orderedQty - l.receivedQty),
    unitPrice: l.unitPrice,
    taxRate: 0,
    lineTotal: l.orderedQty * l.unitPrice,
    status: lineStatusFor(status, l.orderedQty, l.receivedQty),
  }));
  const supplier = await findMockSupplier(po.supplierId);
  // Seed chỉ có ngày; 00:00 giờ VN giữ nguyên ngày theo Asia/Ho_Chi_Minh.
  const createdAt = `${po.orderDate}T00:00:00+07:00`;
  const wasSent = !["DRAFT", "PENDING_APPROVAL", "APPROVED", "CANCELLED"].includes(status);
  // ASSUMPTION (mock demo): PO seed còn ở CONFIRMED có lần gửi FAILED để demo được luồng
  // "gửi lỗi → khôi phục gửi"; các PO seed đã nhận hàng có lần gửi thành công.
  const deliveryFailed = status === "CONFIRMED";
  const submitted = !["DRAFT", "CANCELLED"].includes(status);
  const approved = submitted && status !== "PENDING_APPROVAL";
  if (wasSent) {
    addDecision(po.poId, {
      id: `${po.poId}-decision-0`,
      // BE: lượt gửi đầu tiên là generation 0 (po_delivery_control.generation DEFAULT 0)
      generation: 0,
      previousExpectedAt: po.expectedDate || null,
      expectedAt: po.expectedDate || null,
      reason: null,
      reconciled: false,
      acknowledgePastDue: false,
      channel: "EMAIL",
      recipient: supplier?.code ?? po.supplierId,
      actor: po.createdBy,
      requestedAt: createdAt,
    });
    addDelivery(po.poId, {
      id: `${po.poId}-delivery-0`,
      channel: "EMAIL",
      status: deliveryFailed ? "FAILED" : "SENT",
      attemptedAt: createdAt,
      sentAt: deliveryFailed ? null : createdAt,
      // Cùng dạng chuỗi BE DeliveryAttemptRecorder: "<reference>: <TênException>"
      failure: deliveryFailed ? `purchase-order:${po.poId}: MailSendException` : null,
      generation: 0,
      recipient: supplier?.code ?? po.supplierId,
      templateCode: "purchase-order.sent",
    });
  }
  return {
    purchaseOrderId: po.poId,
    poNumber: po.poNumber,
    type: "STANDARD",
    productionOrderId: null,
    supplierId: po.supplierId,
    supplierCode: supplier?.code ?? null,
    supplierName: supplier?.name ?? null,
    warehouseId: MOCK_WAREHOUSE.id,
    warehouseCode: MOCK_WAREHOUSE.prefix,
    warehouseName: MOCK_WAREHOUSE.name,
    status,
    currency: po.currency,
    orderDate: po.orderDate,
    subtotal: sumLines(lines),
    taxTotal: 0,
    totalAmount: sumLines(lines),
    note: null,
    expectedAt: po.expectedDate || null,
    lines,
    createdAt,
    createdBy: po.createdBy,
    lastModifiedAt: createdAt,
    lastModifiedBy: po.createdBy,
    possibleDuplicate: false,
    revisionNo: 0,
    submittedBy: submitted ? MOCK_SUBMITTER : null,
    submittedAt: submitted ? createdAt : null,
    approvedBy: approved ? MOCK_APPROVER : null,
    approvedAt: approved ? createdAt : null,
    confirmedBy: wasSent ? MOCK_SUBMITTER : null,
    confirmedAt: wasSent ? createdAt : null,
    closedAt: status === "CLOSED" ? createdAt : null,
    closeKind: status === "CLOSED" ? "NORMAL" : null,
    closeReason: null,
    // BE: mọi PO đã huỷ đều có lý do (`ck_purchase_orders_cancel_reason`).
    cancellationReason: status === "CANCELLED" ? (po.rejectionReason ?? "Đã huỷ") : null,
    paymentTermDays: supplier?.paymentTermDays ?? 0,
    leadTimeDays: supplier?.leadTimeDays ?? 0,
    sentAt: wasSent ? createdAt : null,
    // Seed đã nhận hàng ⇒ NCC đã xác nhận; seed CONFIRMED còn chờ NCC phản hồi.
    supplierConfirmationStatus: !wasSent
      ? "NOT_SENT"
      : status === "CONFIRMED"
        ? "PENDING"
        : "CONFIRMED",
    supplierRespondedAt: wasSent && status !== "CONFIRMED" ? createdAt : null,
    supplierReference: null,
    supplierResponseNote: null,
    deliveryStatus: !wasSent ? "NOT_SENT" : deliveryFailed ? "FAILED" : "DELIVERED",
    cancellationDeliveryStatus: "NOT_REQUIRED",
    warnings: [],
  };
}

/** BE `PurchaseOrder#subtotal` — Σ quantityOrdered × unitPrice (trước thuế). */
export function sumLines(lines: readonly MockBePoLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantityOrdered * l.unitPrice, 0);
}

/** BE `PurchaseOrder#taxTotal` — Σ thuế từng dòng, làm tròn 2 chữ số. */
export function sumTax(lines: readonly MockBePoLine[]): number {
  return lines.reduce(
    (sum, l) => sum + Math.round(l.quantityOrdered * l.unitPrice * l.taxRate) / 100,
    0,
  );
}

/** Kho nhận của PO mock — trùng kho HCM của seed BE demo. */
export const MOCK_WAREHOUSE = {
  id: "d99123fd-2997-4751-6bb9-e10a2e6d9949",
  prefix: "HCM",
  name: "Kho Hồ Chí Minh",
} as const;
/** Người gửi duyệt / người duyệt của seed — hai người khác nhau (BR-PO-002 bốn mắt). */
export const MOCK_SUBMITTER = "00000000-0000-4000-8000-0000000000a1";
export const MOCK_APPROVER = "00000000-0000-4000-8000-0000000000a2";

function lineStatusFor(
  status: BePoStatus,
  ordered: number,
  received: number,
): MockBePoLine["status"] {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "CLOSED") return received >= ordered ? "RECEIVED" : "CLOSED";
  if (received >= ordered) return "RECEIVED";
  return received > 0 ? "PARTIALLY_RECEIVED" : "OPEN";
}

export function touch(po: MockBePo, patch: Partial<MockBePo>): MockBePo {
  return {
    ...po,
    ...patch,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: MOCK_PO_ACTOR,
  };
}

/** Ngày hôm nay theo Asia/Ho_Chi_Minh (BE `BusinessCalendar.date`). */
export function todayVn(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

/* ── Response / request helpers ─────────────────────────────────────── */

export function beOk(data: unknown, status = 200) {
  return { status, data, headers: {} };
}

export function beError(
  status: number,
  errorCode: string,
  message: string,
  fieldErrors?: MockFieldError[],
) {
  return {
    status,
    data: { success: false, errorCode, message, fieldErrors: fieldErrors ?? [] },
    headers: {},
  };
}

export function bePage<T>(all: readonly T[], page: number, size: number) {
  const totalElements = all.length;
  const totalPages = Math.ceil(totalElements / size);
  return {
    items: all.slice(page * size, page * size + size),
    page,
    size,
    totalElements,
    totalPages,
    hasNext: page + 1 < totalPages,
    hasPrevious: page > 0,
  };
}

export function notFound(id: string) {
  return beError(404, "PURCHASE_ORDER_NOT_FOUND", `No purchase order with id ${id}`);
}

export function invalidTransition(message: string) {
  return beError(409, "INVALID_PURCHASE_ORDER_TRANSITION", message);
}

/** axios giữ query trong `config.params` (chưa ghép vào `config.url`) tới khi adapter thật chạy. */
export function readParams(config: AxiosRequestConfig): Record<string, unknown> {
  const params: unknown = config.params;
  return isRecord(params) ? params : {};
}

export function readInt(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) ? n : fallback;
}

export function readRouteId(config: AxiosRequestConfig): string {
  const params: unknown = "_mockParams" in config ? config._mockParams : undefined;
  return isRecord(params) ? readString(params.id) : "";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Body axios (chuỗi JSON hoặc object đã parse). */
export function parseJsonBody(data: unknown): Record<string, unknown> {
  if (typeof data === "string") {
    try {
      const parsed: unknown = JSON.parse(data);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return isRecord(data) ? data : {};
}
