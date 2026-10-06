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

/** BE `PurchaseOrderStatus.java` — 7 trạng thái. */
export const BE_PO_STATUSES = [
  "DRAFT",
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
  "CLOSED",
  "CLOSED_SHORT",
  "CANCELLED",
] as const;
export type BePoStatus = (typeof BE_PO_STATUSES)[number];
export type ConfirmationStatus = "NOT_SENT" | "PENDING" | "CONFIRMED" | "REJECTED";
export type PoDeliveryStatus = "NOT_SENT" | "QUEUED" | "RETRYING" | "FAILED" | "DELIVERED";

/**
 * Seed `mock-data.ts` dùng từ vựng Title Case của docs 02 (không được sửa file seed). Đây là
 * chỗ DUY NHẤT dịch sang mã BE. BE gộp submit+approve nên `Pending Approval` = DRAFT chưa
 * duyệt; `Confirmed` ≙ SENT; `Received` ≙ CLOSED (javadoc `PurchaseOrderStatus`).
 */
const LEGACY_PO_STATUS: Record<PoStatus, BePoStatus> = {
  Draft: "DRAFT",
  "Pending Approval": "DRAFT",
  Approved: "APPROVED",
  Confirmed: "SENT",
  "Partially Received": "PARTIALLY_RECEIVED",
  Received: "CLOSED",
  Closed: "CLOSED",
  Cancelled: "CANCELLED",
};

/** BE `PurchaseOrderStatus#canTransitionTo`. */
export const BE_PO_TRANSITIONS: Record<BePoStatus, readonly BePoStatus[]> = {
  DRAFT: ["APPROVED", "CANCELLED"],
  APPROVED: ["SENT", "CANCELLED"],
  SENT: ["CANCELLED"],
  PARTIALLY_RECEIVED: ["CLOSED_SHORT"],
  CLOSED: [],
  CLOSED_SHORT: [],
  CANCELLED: [],
};

export const BE_MAX_PAGE_SIZE = 200;
export const BE_DEFAULT_PAGE_SIZE = 20;
/** BE `ErrorCode.VALIDATION_FAILED` — câu chung khi lỗi đến từ IllegalArgumentException. */
export const BE_GENERIC_VALIDATION_MESSAGE = "Invalid request data";
export const MOCK_PO_ACTOR = "mock-user";

export interface MockBePoLine {
  lineId: string;
  sku: string;
  description: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  openQuantity: number;
  unitPrice: number;
}

export interface MockBePo {
  purchaseOrderId: string;
  poNumber: string;
  supplierId: string;
  status: BePoStatus;
  currency: string;
  totalAmount: number;
  expectedAt: string | null;
  lines: MockBePoLine[];
  createdAt: string;
  createdBy: string;
  lastModifiedAt: string;
  lastModifiedBy: string;
  possibleDuplicate: boolean;
  cancellationReason: string | null;
  closeShortReason: string | null;
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
}

let poStore: Map<string, MockBePo> | null = null;
const deliveryStore = new Map<string, MockDeliveryAttempt[]>();
const decisionStore = new Map<string, MockDeliveryDecision[]>();

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
const TERMINAL_FOR_WARNINGS: readonly BePoStatus[] = ["CANCELLED", "CLOSED", "CLOSED_SHORT"];

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
  for (const [poId, attempts] of deliveryStore) {
    const latest = attempts[0];
    if (!latest || latest.status !== "PENDING") continue;
    const sentAt = Date.parse(latest.attemptedAt) + MOCK_TRANSPORT_DELAY_MS;
    if (sentAt > now) continue;
    attempts[0] = { ...latest, status: "SENT", sentAt: new Date(sentAt).toISOString() };
    const po = store.get(poId);
    if (po?.deliveryStatus === "QUEUED") store.set(poId, { ...po, deliveryStatus: "DELIVERED" });
  }
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
}

async function seedToBePo(po: PurchaseOrder): Promise<MockBePo> {
  const lines: MockBePoLine[] = po.lines.map((l) => ({
    lineId: l.lineId,
    sku: l.skuId,
    description: null,
    quantityOrdered: l.orderedQty,
    quantityReceived: l.receivedQty,
    openQuantity: Math.max(0, l.orderedQty - l.receivedQty),
    unitPrice: l.unitPrice,
  }));
  const status = LEGACY_PO_STATUS[po.status];
  const supplier = await findMockSupplier(po.supplierId);
  // Seed chỉ có ngày; 00:00 giờ VN giữ nguyên ngày theo Asia/Ho_Chi_Minh.
  const createdAt = `${po.orderDate}T00:00:00+07:00`;
  const wasSent = status !== "DRAFT" && status !== "APPROVED" && status !== "CANCELLED";
  // ASSUMPTION (mock demo): PO seed còn ở SENT có lần gửi FAILED để demo được luồng
  // "gửi lỗi → khôi phục gửi"; các PO seed đã nhận hàng có lần gửi thành công.
  const deliveryFailed = status === "SENT";
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
    });
  }
  return {
    purchaseOrderId: po.poId,
    poNumber: po.poNumber,
    supplierId: po.supplierId,
    status,
    currency: po.currency,
    totalAmount: sumLines(lines),
    expectedAt: po.expectedDate || null,
    lines,
    createdAt,
    createdBy: po.createdBy,
    lastModifiedAt: createdAt,
    lastModifiedBy: po.createdBy,
    possibleDuplicate: false,
    cancellationReason: status === "CANCELLED" ? (po.rejectionReason ?? null) : null,
    closeShortReason: null,
    paymentTermDays: supplier?.paymentTermDays ?? 0,
    leadTimeDays: supplier?.leadTimeDays ?? 0,
    sentAt: wasSent ? createdAt : null,
    // Seed đã nhận hàng ⇒ NCC đã xác nhận; seed SENT còn chờ NCC phản hồi.
    supplierConfirmationStatus: !wasSent ? "NOT_SENT" : status === "SENT" ? "PENDING" : "CONFIRMED",
    supplierRespondedAt: wasSent && status !== "SENT" ? createdAt : null,
    supplierReference: null,
    supplierResponseNote: null,
    deliveryStatus: !wasSent ? "NOT_SENT" : deliveryFailed ? "FAILED" : "DELIVERED",
    cancellationDeliveryStatus: "NOT_REQUIRED",
    warnings: [],
  };
}

/** BE `PurchaseOrder#totalAmount` — Σ quantityOrdered × unitPrice. */
export function sumLines(lines: readonly MockBePoLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantityOrdered * l.unitPrice, 0);
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
