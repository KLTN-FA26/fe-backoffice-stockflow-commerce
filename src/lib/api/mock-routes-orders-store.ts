/**
 * Mock đơn bán — store in-memory + chuyển mock-data → wire BE `OrderResponse`, dùng chung cho
 * `mock-routes-orders.ts` (list/detail/lịch sử/huỷ/giữ/giao thất bại/đóng phần còn lại),
 * `mock-routes-orders-actions.ts` (release, credit hold, lệnh sản xuất) và mock xuất kho
 * `mock-routes-fulfillment*.ts` (đổi trạng thái đơn, snapshot + checksum thiết kế).
 *
 * MỘT nguồn trạng thái duy nhất cho mỗi đơn: `MockOrderState` trong `states`. Trạng thái hiệu lực =
 * `state.status` nếu phiên mock đã đổi, còn không = trạng thái seed từ mock-data. Mọi đổi trạng thái
 * đi qua `moveTo` (ghi lịch sử + dọn dữ liệu giữ / giao thất bại như BE `Order#transitionTo`).
 *
 * mock-data (không được sửa) dùng 20 trạng thái docs 17 và chưa có phương thức thanh toán B2B,
 * hạn mức công nợ, lô giao hay lệnh sản xuất. Mọi suy diễn dưới đây là ASSUMPTION mock-only — chỉ
 * GÁN THUỘC TÍNH cho đơn có sẵn theo quy tắc, không thêm bản ghi đơn mới.
 */

import type { AxiosRequestConfig } from "axios";
import type { Order, OrderLine, OrderManagementStatus } from "@/lib/mock-data";

/** BE `order/api/OrderStatus.java` — 19 trạng thái (BE PR #133). */
export type BeOrderStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "IN_PRODUCTION"
  | "READY_TO_FULFILL"
  | "PICKING"
  | "PARTIALLY_FULFILLED"
  | "PACKED"
  | "ON_HOLD"
  | "SHIPPED"
  | "DELIVERY_FAILED"
  | "DELIVERED"
  | "RETURN_REQUESTED"
  | "RETURNED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "COMPLETED"
  | "CANCELLED"
  | "CLOSED";
export type BePaymentTerm = "PREPAID" | "DEPOSIT" | "CREDIT";
/** BE `order/api/HoldReason.java`. */
export type BeHoldReason =
  | "CREDIT"
  | "DESIGN_MISMATCH"
  | "PAYMENT"
  | "ADDRESS"
  | "INVENTORY"
  | "CUSTOMER"
  | "FRAUD"
  | "OTHER";
/** BE `order/api/OrderShipmentStatus.java`. */
export type BeShipmentStatus = "HANDED_OVER" | "DELIVERED" | "DELIVERY_FAILED" | "RETURNED";

/**
 * mock-data dùng 20 trạng thái docs 17; BE (PR #133) có 19 — gần như 1-1. "Payment Failed" gộp vào
 * CANCELLED (BE không có PAYMENT_FAILED, G3-Q2); "In Transit" là SHIPPED.
 */
export const MOCK_TO_BACKEND_STATUS: Record<OrderManagementStatus, BeOrderStatus> = {
  "Pending Payment": "PENDING_PAYMENT",
  "Payment Failed": "CANCELLED",
  Confirmed: "CONFIRMED",
  "In Production": "IN_PRODUCTION",
  "Ready to Fulfill": "READY_TO_FULFILL",
  Picking: "PICKING",
  Packed: "PACKED",
  "Partially Fulfilled": "PARTIALLY_FULFILLED",
  "On Hold": "ON_HOLD",
  Shipped: "SHIPPED",
  "In Transit": "SHIPPED",
  "Delivery Failed": "DELIVERY_FAILED",
  Delivered: "DELIVERED",
  "Return Requested": "RETURN_REQUESTED",
  Completed: "COMPLETED",
  Closed: "CLOSED",
  Cancelled: "CANCELLED",
  Returned: "RETURNED",
  Refunded: "REFUNDED",
  "Partially Refunded": "PARTIALLY_REFUNDED",
};

/**
 * BE `OrderStatus#canTransitionTo(CANCELLED)` (PR #133): DRAFT, PENDING_PAYMENT, CONFIRMED,
 * IN_PRODUCTION, READY_TO_FULFILL, PICKING, ON_HOLD. PACKED trở đi đi luồng trả hàng (BR-ORD-004);
 * ngoài ra `Order#requireNotPacked` chặn cả đơn ON_HOLD đã từng đóng gói (`packedAt`).
 */
export const CANCELLABLE_STATUSES: readonly BeOrderStatus[] = [
  "DRAFT",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY_TO_FULFILL",
  "PICKING",
  "ON_HOLD",
];

/** BE `OrderStatus#mayBePutOnHold`. */
export const HOLDABLE_STATUSES: readonly BeOrderStatus[] = [
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY_TO_FULFILL",
  "PICKING",
  "PARTIALLY_FULFILLED",
  "PACKED",
];

/** BE `OrderStatus#holdsStock` — đơn còn giữ hàng (mock: mỗi dòng 1 reservation). */
const STOCK_HOLDING_STATUSES: readonly BeOrderStatus[] = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY_TO_FULFILL",
  "PICKING",
  "PARTIALLY_FULFILLED",
  "PACKED",
  "ON_HOLD",
];

/** Trạng thái sau release (BE `Order#release` gán `warehouseId`) — đơn mock đã có kho xử lý. */
const RELEASED_STATUSES: readonly BeOrderStatus[] = [
  "IN_PRODUCTION",
  "READY_TO_FULFILL",
  "PICKING",
  "PARTIALLY_FULFILLED",
  "PACKED",
  "SHIPPED",
  "DELIVERY_FAILED",
  "DELIVERED",
  "RETURN_REQUESTED",
  "RETURNED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "COMPLETED",
  "CLOSED",
];

/** BE `HoldReason#raisedByHand` — CREDIT và DESIGN_MISMATCH là của hệ thống. */
export const MANUAL_HOLD_REASONS: readonly BeHoldReason[] = [
  "PAYMENT",
  "ADDRESS",
  "INVENTORY",
  "CUSTOMER",
  "FRAUD",
  "OTHER",
];

/** BE `DeliveryFailureReason`. */
export const DELIVERY_FAILURE_REASONS: readonly string[] = [
  "CUSTOMER_ABSENT",
  "REFUSED",
  "WRONG_ADDRESS",
  "LOST",
  "DAMAGED",
  "OTHER",
];

/** BE `CancellationReasonCode` — huỷ admin và đóng phần còn lại đều nhận đủ các mã này. */
export const CANCELLATION_REASON_CODES: readonly string[] = [
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

/**
 * BE `OrderStatusFilter`: một sprint còn nhận hai tên cũ ở bộ lọc `status` — `IN_FULFILMENT` = PICKING,
 * PARTIALLY_FULFILLED, PACKED; `PAID` = CONFIRMED. Tên lạ khác → 400 UNSUPPORTED_PARAMETER.
 */
export const STATUS_FILTER_ALIAS: Readonly<Record<string, readonly BeOrderStatus[]>> = {
  IN_FULFILMENT: ["PICKING", "PARTIALLY_FULFILLED", "PACKED"],
  PAID: ["CONFIRMED"],
};

/** Đủ 19 giá trị BE — giá trị lọc `status` hợp lệ (ngoài hai bí danh trên). */
export const BE_ORDER_STATUSES: readonly BeOrderStatus[] = [
  "DRAFT",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY_TO_FULFILL",
  "PICKING",
  "PARTIALLY_FULFILLED",
  "PACKED",
  "ON_HOLD",
  "SHIPPED",
  "DELIVERY_FAILED",
  "DELIVERED",
  "RETURN_REQUESTED",
  "RETURNED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "COMPLETED",
  "CANCELLED",
  "CLOSED",
];

export function isCustomLine(line: Order["lines"][number]): boolean {
  return line.designId != null;
}

/**
 * ASSUMPTION (mock-only, open-question D13): mock-data chỉ có phương thức thanh toán bán lẻ.
 * Đơn in đang chờ thanh toán → đặt cọc (docs 14 §4.1: thiết kế mới thường đặt cọc); COD /
 * chuyển khoản (trả sau) → công nợ; thẻ / ví → trả trước 100%.
 */
function deriveTerm(order: Order): BePaymentTerm {
  if (order.status === "Pending Payment" && order.lines.some(isCustomLine)) return "DEPOSIT";
  if (order.paymentMethodType === "COD" || order.paymentMethodType === "Bank Transfer") {
    return "CREDIT";
  }
  return "PREPAID";
}

/**
 * ASSUMPTION (mock-only, open-question D13): chưa có hạn mức công nợ theo khách — giả lập hạn mức
 * chung 100.000 ₫ để đơn công nợ On Hold trong mock-data thật sự vượt hạn mức.
 */
export const MOCK_CREDIT_LIMIT = 100_000;

/** Hồ sơ công nợ khách (BE `CreditTerms`) — `depositPercent` là phần trăm (30 = 30%). */
export interface MockCreditProfile {
  allowedTerms: readonly BePaymentTerm[];
  defaultTerm: BePaymentTerm;
  depositPercent: number | null;
  /** ASSUMPTION (mock-only): khách có khoản phải thu quá hạn (BE lấy từ module payment). */
  hasOverdue: boolean;
}

/**
 * ASSUMPTION (mock-only, D13): mock-data chưa có hồ sơ công nợ. Gán theo phương thức các đơn đang
 * có của khách (`deriveTerm`) để mọi đơn đều dùng phương thức khách được phép, và phủ đủ ca demo:
 * nhiều phương thức (CUS-0007 — đơn đang chờ duyệt công nợ), hạn chế không cọc (CUS-0006, đang có
 * nợ quá hạn: đơn COD giao thất bại chưa thu), chỉ cọc (CUS-0012). Khách khác: chỉ trả trước, như
 * BE `CreditTerms.prepaidOnly`.
 */
const MOCK_CREDIT_PROFILES: Readonly<Record<string, MockCreditProfile>> = {
  "CUS-0003": {
    allowedTerms: ["PREPAID", "CREDIT"],
    defaultTerm: "CREDIT",
    depositPercent: null,
    hasOverdue: false,
  },
  "CUS-0004": {
    allowedTerms: ["PREPAID", "CREDIT"],
    defaultTerm: "PREPAID",
    depositPercent: null,
    hasOverdue: false,
  },
  "CUS-0006": {
    allowedTerms: ["PREPAID", "CREDIT"],
    defaultTerm: "CREDIT",
    depositPercent: null,
    hasOverdue: true,
  },
  "CUS-0007": {
    allowedTerms: ["PREPAID", "DEPOSIT", "CREDIT"],
    defaultTerm: "CREDIT",
    depositPercent: 40,
    hasOverdue: false,
  },
  "CUS-0008": {
    allowedTerms: ["PREPAID", "DEPOSIT", "CREDIT"],
    defaultTerm: "PREPAID",
    depositPercent: 25,
    hasOverdue: false,
  },
  "CUS-0012": {
    allowedTerms: ["PREPAID", "DEPOSIT"],
    defaultTerm: "DEPOSIT",
    depositPercent: 30,
    hasOverdue: false,
  },
};

const PREPAID_ONLY: MockCreditProfile = {
  allowedTerms: ["PREPAID"],
  defaultTerm: "PREPAID",
  depositPercent: null,
  hasOverdue: false,
};

export function creditProfileOf(mockCustomerId: string | undefined): MockCreditProfile {
  return (mockCustomerId && MOCK_CREDIT_PROFILES[mockCustomerId]) || PREPAID_ONLY;
}

/**
 * Id khách mock (`CUS-0007`) → UUID cố định — BE đánh id khách bằng UUID (`GET /orders?customerId`,
 * `/orders/credit-position/{customerId}` đều bind `UUID`). Chỉ đổi ở biên mock; mock-data giữ
 * nguyên. Cùng id luôn ra cùng UUID (băm, không ngẫu nhiên); version 4 + variant RFC 4122.
 */
export function mockCustomerUuid(mockCustomerId: string): string {
  const hex = fakeSha256(`customer:${mockCustomerId}`);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${"89ab"[Number.parseInt(hex.slice(16, 17), 16) % 4]}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

/** Làm tròn theo đơn vị nhỏ nhất của tiền tệ (VND 0 số lẻ, USD 2) — như BE scale theo currency. */
export function roundMoney(amount: number, currency: string): number {
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
    .maximumFractionDigits;
  const factor = 10 ** (digits ?? 0);
  return Math.round(amount * factor) / factor;
}

/** SHA-256 giả 64 hex, ổn định theo seed (FNV-1a lặp 8 lần). */
export function fakeSha256(seed: string): string {
  let out = "";
  for (let round = 0; round < 8; round++) {
    let hash = 0x811c9dc5;
    for (const char of `${round}:${seed}`) {
      hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
    }
    out += (hash >>> 0).toString(16).padStart(8, "0");
  }
  return out;
}

/** Dòng mock có `designId` = dòng tuỳ chỉnh: BE trả snapshot đã khoá + SHA-256 của bundle. */
export const snapshotIdOf = (line: OrderLine) => `SNAP-${line.designId ?? ""}`;
export const lockedChecksumOf = (line: OrderLine) => fakeSha256(line.lineId);

/* ── State ───────────────────────────────────────────────────────────── */

/** Một bước lịch sử (BE `OrderStatusChangeResponse`). `from` null ở bước đầu. */
export interface MockHistoryEntry {
  from: BeOrderStatus | null;
  to: BeOrderStatus;
  reason: string | null;
  occurredAt: string;
}

/** Bước phát sinh trong phiên. `from` không lưu: luôn là `to` của bước trước (suy ra khi đọc). */
interface SessionStep {
  to: BeOrderStatus;
  reason: string | null;
  occurredAt: string;
}

export interface MockShipment {
  shipmentId: string;
  status: BeShipmentStatus;
  handedOverAt: string;
  lines: { lineId: string; quantity: number }[];
}

/** BE `OrderResponse.Cancellation`. */
export interface MockCancellation {
  reasonCode: string;
  reason: string | null;
  retainedAmount: number;
  feeReason: string | null;
  feeDetail: string | null;
  feeAmount: number | null;
}

interface MockOrderState {
  /** Đã gán dữ liệu seed suy từ mock-data (giữ, packedAt, lô giao…) — chỉ một lần. */
  seeded: boolean;
  /** undefined = chưa đổi trong phiên → trạng thái seed của mock-data. */
  status?: BeOrderStatus;
  paymentTerm?: BePaymentTerm;
  /** % cọc chốt khi từ chối công nợ → đặt cọc (BE CreditRefusalRequest.depositPercent). */
  depositPercent?: number;
  warehouseId?: string;
  releasedAt?: string;
  cancellation?: MockCancellation;
  /** Lần đầu đóng gói xong (BE `packedAt`): từ đó đơn không huỷ được, kể cả khi bị giữ. */
  packedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  /** Có khi và chỉ khi đơn ON_HOLD (BE `clearHold` khi rời giữ). */
  holdReason?: BeHoldReason;
  /** Trạng thái quay về khi gỡ giữ; undefined với giữ công nợ (BE `submitOnCredit`). */
  statusBeforeHold?: BeOrderStatus;
  holdNote?: string;
  /** Có khi và chỉ khi đơn DELIVERY_FAILED. */
  deliveryFailureReason?: string;
  shipments: MockShipment[];
  /** lineId → số đơn vị đã đóng (đóng phần còn lại — BE `OrderLine#cancelledQuantity`). */
  closedUnits: Record<string, number>;
  history: SessionStep[];
}

const states = new Map<string, MockOrderState>();

/** Xoá MỌI trạng thái phiên (vòng đời, công nợ, release, huỷ, lịch sử) — test gọi giữa các ca. */
export function resetOrderMockStore(): void {
  states.clear();
}

function stateById(orderId: string): MockOrderState {
  let state = states.get(orderId);
  if (!state) {
    state = { seeded: false, shipments: [], closedUnits: {}, history: [] };
    states.set(orderId, state);
  }
  return state;
}

/** Trạng thái mock-data đã đóng gói xong ít nhất một lần (nên có `packedAt`). */
const PACKED_ONWARDS_MOCK_STATUSES: readonly OrderManagementStatus[] = [
  "Packed",
  "Partially Fulfilled",
  "Shipped",
  "In Transit",
  "Delivery Failed",
  "Delivered",
  "Return Requested",
  "Completed",
  "Closed",
  "Returned",
  "Refunded",
  "Partially Refunded",
];

/**
 * Trạng thái của đơn, seed một lần từ mock-data (mock-data không có các field này):
 * - đơn "On Hold" công nợ (phương thức CREDIT) = giữ CREDIT — vượt hạn mức, chờ duyệt (BE
 *   `submitOnCredit`, không có `statusBeforeHold`); "On Hold" khác = giữ ADDRESS từ PICKING;
 * - đơn đã qua khâu đóng gói có `packedAt`;
 * - "Partially Fulfilled" đã bàn giao một lô (thiếu 2 đơn vị — "Pick Short 2" của mock-data);
 * - "Delivery Failed" do khách vắng mặt.
 * Phần seed chỉ áp khi phiên chưa đổi chính field đó (vd mock xuất kho đã đổi trạng thái trước).
 */
function stateOf(order: Order): MockOrderState {
  const state = stateById(order.orderId);
  if (state.seeded) return state;
  state.seeded = true;
  const status = state.status ?? MOCK_TO_BACKEND_STATUS[order.status];
  if (status === "ON_HOLD" && state.holdReason === undefined) {
    if ((state.paymentTerm ?? deriveTerm(order)) === "CREDIT") {
      state.holdReason = "CREDIT";
    } else {
      state.holdReason = "ADDRESS";
      state.statusBeforeHold = "PICKING";
      state.holdNote = "Sai phường — chờ khách xác nhận địa chỉ";
    }
  }
  if (status === "DELIVERY_FAILED" && state.deliveryFailureReason === undefined) {
    state.deliveryFailureReason = "CUSTOMER_ABSENT";
  }
  if (state.packedAt === undefined && PACKED_ONWARDS_MOCK_STATUSES.includes(order.status)) {
    state.packedAt = order.shippedAt ?? order.placedAt;
  }
  const first = order.lines[0];
  if (!state.shipments.length && order.status === "Partially Fulfilled" && first) {
    state.shipments.push({
      shipmentId: `${order.orderId}-SHIP-1`,
      status: "HANDED_OVER",
      handedOverAt: order.shippedAt ?? order.placedAt,
      lines: [{ lineId: first.lineId, quantity: Math.max(1, first.quantity - 2) }],
    });
  }
  return state;
}

export function backendStatus(order: Order): BeOrderStatus {
  return stateOf(order).status ?? MOCK_TO_BACKEND_STATUS[order.status];
}

/**
 * Đổi trạng thái như BE `Order#transitionTo`: ghi một bước lịch sử, đóng gói xong thì ghi `packedAt`
 * (một lần), rời ON_HOLD thì xoá dữ liệu giữ, rời DELIVERY_FAILED thì xoá lý do giao thất bại.
 * Không kiểm bảng chuyển — route kiểm trước, như service BE.
 */
function moveTo(state: MockOrderState, to: BeOrderStatus, reason: string | null): void {
  const at = new Date().toISOString();
  state.status = to;
  state.history.push({ to, reason, occurredAt: at });
  if (to === "PACKED") state.packedAt ??= at;
  if (to !== "ON_HOLD") {
    state.holdReason = undefined;
    state.statusBeforeHold = undefined;
    state.holdNote = undefined;
  }
  if (to !== "DELIVERY_FAILED") state.deliveryFailureReason = undefined;
}

/** Trạng thái BE hiện tại của một đơn mock — cho mock xuất kho. */
export async function backendOrderStatusOf(orderId: string): Promise<BeOrderStatus | undefined> {
  const order = await findOrder(orderId);
  return order ? backendStatus(order) : undefined;
}

/**
 * Mock xuất kho đổi trạng thái đơn như BE (READY_TO_FULFILL → PICKING → PACKED; kiểm tra lại thiết kế
 * đạt thì gỡ giữ DESIGN_MISMATCH thẳng sang PACKED). Đồng bộ (không có `Order`) — seed vẫn áp sau đó
 * cho các field phiên chưa đổi.
 */
export function setMockOrderStatus(orderId: string, status: BeOrderStatus): void {
  moveTo(stateById(orderId), status, null);
}

/**
 * Mock xuất kho giữ đơn do lệch checksum thiết kế (BE `HoldReason.DESIGN_MISMATCH`): nhớ trạng thái
 * đang làm để kiểm tra lại đạt thì quay về. Đơn đã ON_HOLD thì không đổi (BE `mayBePutOnHold` false).
 */
export async function putMockOrderOnDesignHold(orderId: string): Promise<void> {
  const order = await findOrder(orderId);
  if (!order) return;
  const state = stateOf(order);
  const before = backendStatus(order);
  if (before === "ON_HOLD") return;
  moveTo(state, "ON_HOLD", "DESIGN_MISMATCH");
  state.holdReason = "DESIGN_MISMATCH";
  state.statusBeforeHold = before;
  state.holdNote = undefined;
}

export function paymentTermOf(order: Order): BePaymentTerm {
  return stateOf(order).paymentTerm ?? deriveTerm(order);
}

/** Dữ liệu giữ đơn hiện tại (chỉ đọc) — undefined khi đơn không ON_HOLD. */
export function holdOf(
  order: Order,
): { reason: BeHoldReason; statusBeforeHold: BeOrderStatus | null } | undefined {
  const state = stateOf(order);
  if (backendStatus(order) !== "ON_HOLD" || !state.holdReason) return undefined;
  return { reason: state.holdReason, statusBeforeHold: state.statusBeforeHold ?? null };
}

/**
 * Đơn đang chờ quyết định công nợ: BE `Order#requireCreditHold` (ON_HOLD + phương thức CREDIT) VÀ
 * `CreditHoldService#decide` (hồ sơ giữ có lý do CREDIT). Đơn công nợ bị giữ vì lý do khác KHÔNG phải.
 */
export function isCreditHold(order: Order): boolean {
  return holdOf(order)?.reason === "CREDIT" && paymentTermOf(order) === "CREDIT";
}

/**
 * ASSUMPTION (mock-only): BE `printingStartedAt` không có trên `OrderResponse` — mock coi việc in đã
 * bắt đầu khi đơn có dòng in và đã release sang sản xuất trở đi (kể cả bị giữ từ các bước đó).
 */
export function printingStarted(order: Order): boolean {
  if (!order.lines.some(isCustomLine)) return false;
  const status = backendStatus(order);
  const effective = status === "ON_HOLD" ? holdOf(order)?.statusBeforeHold : status;
  return effective != null && RELEASED_STATUSES.includes(effective);
}

/** Đơn đã đóng gói xong ít nhất một lần (BE `Order#requireNotPacked`). */
export function wasPacked(order: Order): boolean {
  return stateOf(order).packedAt !== undefined;
}

export function shipmentsOf(order: Order): readonly MockShipment[] {
  return stateOf(order).shipments;
}

/** Lịch sử phát sinh trong phiên, `from` nối tiếp từ trạng thái seed; bỏ bước không đổi trạng thái. */
export function sessionHistory(order: Order): MockHistoryEntry[] {
  let from: BeOrderStatus = MOCK_TO_BACKEND_STATUS[order.status];
  const entries: MockHistoryEntry[] = [];
  for (const step of stateOf(order).history) {
    if (step.to !== from) entries.push({ from, ...step });
    from = step.to;
  }
  return entries;
}

type StatePatch = Partial<
  Pick<
    MockOrderState,
    | "paymentTerm"
    | "depositPercent"
    | "warehouseId"
    | "releasedAt"
    | "cancellation"
    | "deliveryFailureReason"
    // Giữ công nợ do hệ thống đặt khi đặt đơn vượt hạn mức (BE `Order#submitOnCredit`): không có
    // statusBeforeHold — giữ tay đi qua `putOnHold`.
    | "holdReason"
  >
>;

/** Ghi một bước chuyển trạng thái (+ thay đổi đi kèm) vào store, như BE lưu status change. */
export function applyTransition(
  order: Order,
  to: BeOrderStatus,
  reason: string | null,
  patch: StatePatch = {},
): void {
  const state = stateOf(order);
  moveTo(state, to, reason);
  Object.assign(state, patch);
}

/** Giữ đơn tay (BE `Order#putOnHold`) — lý do do route kiểm (`MANUAL_HOLD_REASONS`). */
export function putOnHold(order: Order, reason: BeHoldReason, note: string | null): void {
  const state = stateOf(order);
  const before = backendStatus(order);
  moveTo(state, "ON_HOLD", note ? `${reason}: ${note}` : reason);
  state.holdReason = reason;
  state.statusBeforeHold = before;
  state.holdNote = note ?? undefined;
}

/* ── Lô giao (split shipments, G4-Q3) ────────────────────────────────── */

function shippedUnits(state: MockOrderState, lineId: string, includingReturned: boolean): number {
  return state.shipments
    .filter((shipment) => includingReturned || shipment.status !== "RETURNED")
    .flatMap((shipment) => shipment.lines)
    .filter((line) => line.lineId === lineId)
    .reduce((sum, line) => sum + line.quantity, 0);
}

/** BE `Order#outstandingUnits`: chưa đóng và không nằm trong lô còn ở hãng / ở khách. */
function outstandingUnits(order: Order, state: MockOrderState): number {
  return order.lines.reduce(
    (sum, line) =>
      sum +
      line.quantity -
      (state.closedUnits[line.lineId] ?? 0) -
      shippedUnits(state, line.lineId, false),
    0,
  );
}

/** BE `Order#unshippedUnits`: chưa đóng và chưa từng bàn giao. */
function unshippedUnits(order: Order, state: MockOrderState): number {
  return order.lines.reduce(
    (sum, line) =>
      sum +
      Math.max(
        0,
        line.quantity -
          (state.closedUnits[line.lineId] ?? 0) -
          shippedUnits(state, line.lineId, true),
      ),
    0,
  );
}

/** Thay đổi khiến đơn xem lại các lô (BE `Order.ShipmentChange`). */
type ShipmentChange = "HANDED_OVER" | "OUTCOME" | "RETURNED" | "CLOSED" | "RESUMED";

/** BE `Order#followShipments`: trạng thái đơn theo các lô sau khi một lô / phần còn lại đổi. */
function followShipments(
  order: Order,
  state: MockOrderState,
  change: ShipmentChange,
  reason: string | null,
): void {
  const current = backendStatus(order);
  if (!state.shipments.length || current === "ON_HOLD") return;
  let target: BeOrderStatus;
  if (outstandingUnits(order, state) > 0) {
    const allBack = state.shipments.every((shipment) => shipment.status === "RETURNED");
    if (allBack && unshippedUnits(order, state) === 0) target = "RETURNED";
    else if (
      change === "HANDED_OVER" ||
      change === "RETURNED" ||
      (current !== "PACKED" && current !== "PICKING" && current !== "PARTIALLY_FULFILLED")
    )
      target = "PARTIALLY_FULFILLED";
    else target = current;
  } else if (state.shipments.some((shipment) => shipment.status === "HANDED_OVER")) {
    target = "SHIPPED";
  } else if (state.shipments.some((shipment) => shipment.status === "DELIVERY_FAILED")) {
    target = "DELIVERY_FAILED";
  } else if (state.shipments.some((shipment) => shipment.status === "DELIVERED")) {
    target = "DELIVERED";
  } else {
    target = "RETURNED";
  }
  if (target === current) return;
  const lastHandover = state.shipments
    .map((shipment) => shipment.handedOverAt)
    .sort()
    .at(-1);
  moveTo(state, target, reason);
  if (target === "SHIPPED") state.shippedAt = lastHandover;
  if (target === "DELIVERY_FAILED") state.deliveryFailureReason ??= "OTHER";
}

/**
 * Gỡ giữ (BE `Order#resumeFromHold`): về trạng thái đã giữ, ghi lý do `HOLD_RESOLVED_<lý do>: ghi chú`,
 * rồi theo các lô (giữ trong lúc lô có kết quả). Route kiểm điều kiện trước.
 */
export function resumeFromHold(order: Order, note: string): void {
  const state = stateOf(order);
  const back = state.statusBeforeHold;
  const was = state.holdReason;
  if (!back || !was) return;
  moveTo(state, back, `HOLD_RESOLVED_${was}: ${note}`);
  followShipments(order, state, "RESUMED", null);
}

/** Giao thất bại cả đơn (BE `Order#markDeliveryFailed`, chỉ đơn không có lô). */
export function markDeliveryFailed(order: Order, reasonCode: string, note: string | null): void {
  const state = stateOf(order);
  moveTo(state, "DELIVERY_FAILED", note ? `${reasonCode}: ${note}` : reasonCode);
  state.deliveryFailureReason = reasonCode;
}

/**
 * Đóng phần còn lại (BE `Order#closeRemainder`): mọi đơn vị chưa đóng và không nằm trong lô còn hiệu
 * lực (lô RETURNED không tính) bị đóng; đơn theo các lô (không có lô → giữ nguyên trạng thái, như BE).
 */
export function closeRemainder(order: Order, reasonCode: string, note: string | null): void {
  const state = stateOf(order);
  for (const line of order.lines) {
    const left =
      line.quantity -
      (state.closedUnits[line.lineId] ?? 0) -
      shippedUnits(state, line.lineId, false);
    if (left > 0) state.closedUnits[line.lineId] = (state.closedUnits[line.lineId] ?? 0) + left;
  }
  const reason = `REMAINDER_CLOSED_${reasonCode}${note ? `: ${note}` : ""}`;
  followShipments(order, state, "CLOSED", reason);
}

/**
 * BE `Order#termsMet`: trả trước đủ tổng, đơn cọc đủ cọc, công nợ luôn đạt. Gỡ giữ PAYMENT khi chưa
 * đạt → ORDER_BALANCE_NOT_PAID (BE `resumeFromHold`).
 */
export function termsMet(order: Order): boolean {
  const term = paymentTermOf(order);
  if (term === "CREDIT") return true;
  const threshold =
    term === "DEPOSIT" ? (depositRequiredOf(order, stateOf(order), term) ?? 0) : order.grandTotal;
  return order.amountPaid >= threshold;
}

/* ── Response ────────────────────────────────────────────────────────── */

function paymentStatus(term: BePaymentTerm, paid: number, total: number) {
  if (paid >= total && total > 0) return "PAID";
  if (term === "CREDIT") return "ON_CREDIT";
  return paid > 0 ? "PARTIALLY_PAID" : "UNPAID";
}

function depositRequiredOf(order: Order, state: MockOrderState, term: BePaymentTerm) {
  if (term !== "DEPOSIT") return null;
  const percent =
    state.depositPercent ??
    creditProfileOf(order.customerId).depositPercent ??
    // Đơn cọc nhưng khách chưa có hồ sơ — không xảy ra với bảng trên; giữ số an toàn
    30;
  return roundMoney((order.grandTotal * percent) / 100, order.currency);
}

/**
 * mock-data `Order` → BE `OrderResponse` (BE PR #133 + SCRUM-423/427/460). Chỉ field có trong hợp đồng
 * BE; null bị bỏ khỏi JSON ở `ok()` như Jackson `non_null`. Field staff (holdReason, statusBeforeHold,
 * holdNote) luôn gửi — mock chỉ phục vụ back-office.
 */
export function toOrderResponse(order: Order) {
  const state = stateOf(order);
  const term = paymentTermOf(order);
  const status = backendStatus(order);
  const hold = holdOf(order);
  const releasedFrom = status === "ON_HOLD" ? hold?.statusBeforeHold : status;
  const warehouseId =
    state.warehouseId ??
    // Đơn đã qua release trong mock-data (sản xuất / kho / giao) mang kho xử lý sẵn có
    (releasedFrom && RELEASED_STATUSES.includes(releasedFrom)
      ? order.fulfillmentWarehouseId
      : null);
  const closedValue = order.lines.reduce(
    (sum, line) => sum + (state.closedUnits[line.lineId] ?? 0) * line.unitPrice,
    0,
  );
  const effectiveTotal = order.grandTotal - closedValue;
  const amountDue = Math.max(0, effectiveTotal - order.amountPaid);
  const priceOf = (lineId: string) =>
    order.lines.find((line) => line.lineId === lineId)?.unitPrice ?? 0;
  const unitsIn = (lineId: string, statuses: readonly BeShipmentStatus[]) =>
    state.shipments
      .filter((shipment) => statuses.includes(shipment.status))
      .flatMap((shipment) => shipment.lines)
      .filter((line) => line.lineId === lineId)
      .reduce((sum, line) => sum + line.quantity, 0);

  return {
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    customerId: order.customerId ? mockCustomerUuid(order.customerId) : null,
    status,
    totalAmount: order.grandTotal,
    currency: order.currency,
    lines: order.lines.map((line) => ({
      lineId: line.lineId,
      sku: line.skuId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      // ASSUMPTION (mock-only): mỗi dòng giữ hàng từ đúng 1 lô → 1 reservation
      reservationIds: STOCK_HOLDING_STATUSES.includes(status) ? [`RSV-${line.lineId}`] : [],
      designSnapshotId: isCustomLine(line) ? snapshotIdOf(line) : null,
      designChecksum: isCustomLine(line) ? lockedChecksumOf(line) : null,
      // BE (`OrderServiceImpl#lifecycleOf`) gửi ba số, 0 khi chưa có lô. shipped = đơn vị đã bàn giao và
      // chưa trả về (gồm cả đã giao).
      shippedQuantity: unitsIn(line.lineId, ["HANDED_OVER", "DELIVERY_FAILED", "DELIVERED"]),
      deliveredQuantity: unitsIn(line.lineId, ["DELIVERED"]),
      cancelledQuantity: state.closedUnits[line.lineId] ?? 0,
    })),
    placedAt: order.placedAt,
    createdBy: order.createdById ?? null,
    lastModifiedAt: null,
    lastModifiedBy: null,
    contactName: order.recipientName,
    contactEmail: null,
    contactPhone: order.recipientPhone,
    shippingAddress: {
      recipientName: order.recipientName,
      phone: order.recipientPhone,
      line1: order.shippingAddress.street,
      line2: order.shippingAddress.district,
      wardCode: null,
      wardName: order.shippingAddress.ward,
      provinceCode: null,
      provinceName: order.shippingAddress.province,
      countryCode: order.shippingAddress.country,
      postalCode: order.shippingAddress.postalCode,
    },
    billingAddress: null,
    paymentTerm: term,
    warehouseId,
    releasedAt: state.releasedAt ?? null,
    paidAmount: order.amountPaid,
    depositRequired: depositRequiredOf(order, state, term),
    depositReceivedAt:
      term === "DEPOSIT" && order.amountPaid > 0 ? (order.confirmedAt ?? order.placedAt) : null,
    paidInFullAt: order.amountPaid >= order.grandTotal ? (order.confirmedAt ?? null) : null,
    paymentStatus: paymentStatus(term, order.amountPaid, order.grandTotal),
    // ASSUMPTION (mock-only, D13): kỳ hạn công nợ 30 ngày
    creditTermDays: term === "CREDIT" ? 30 : null,
    // balancePolicy null = thu phần còn lại trước khi giao (BE mặc định) — mock không có ON_DELIVERY
    balancePolicy: null,
    cancellation: state.cancellation ?? null,
    holdReason: hold?.reason ?? null,
    statusBeforeHold: hold?.statusBeforeHold ?? null,
    holdReasonPublic: hold
      ? hold.reason === "CREDIT"
        ? "AWAITING_CREDIT_APPROVAL"
        : "UNDER_REVIEW"
      : null,
    holdNote: hold ? (state.holdNote ?? null) : null,
    packedAt: state.packedAt ?? null,
    shippedAt: state.shippedAt ?? order.shippedAt ?? null,
    deliveredAt: state.deliveredAt ?? order.deliveredAt ?? null,
    deliveryFailureReason:
      status === "DELIVERY_FAILED" ? (state.deliveryFailureReason ?? null) : null,
    completedAt: order.completedAt ?? null,
    closedAt: null,
    // ASSUMPTION (mock-only): mock không ghi công nợ theo lô giao → billedAmount 0 (BE bắt đầu từ 0)
    billedAmount: 0,
    effectiveTotal,
    amountDue,
    // BE `Order#amountDueBeforeHandover`: PREPAID / DEPOSIT (thu trước khi giao) = amountDue; CREDIT = 0
    amountDueBeforeHandover: term === "CREDIT" ? 0 : amountDue,
    // BE luôn gửi danh sách (rỗng khi chưa chia lô)
    shipments: state.shipments.map((shipment) => ({
      shipmentId: shipment.shipmentId,
      status: shipment.status,
      amount: shipment.lines.reduce((sum, line) => sum + line.quantity * priceOf(line.lineId), 0),
      billedAmount: null,
      handedOverAt: shipment.handedOverAt,
      outcomeAt: null,
      failureReason: null,
      lines: shipment.lines,
      codAmount: 0,
    })),
    // Chỉ đơn cọc ON_DELIVERY mới để hãng thu — mock không có
    amountDueOnDelivery: 0,
  };
}

/* ── HTTP helpers ────────────────────────────────────────────────────── */

/**
 * Bỏ mọi key có giá trị null (đệ quy) — giống BE Jackson `default-property-inclusion: non_null`.
 * Không bỏ thì mock trả `null` tường minh và che lỗi schema đòi bắt buộc có key.
 */
function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => [k, withoutNulls(v)]),
  );
}

export function ok(data: unknown) {
  return { status: 200, data: withoutNulls({ success: true, data }), headers: {} };
}

export function error(status: number, errorCode: string, message: string, fieldErrors?: unknown[]) {
  return {
    status,
    data: { success: false, errorCode, message, fieldErrors, correlationId: `mock-${Date.now()}` },
    headers: {},
  };
}

export function validationError(field: string, message: string, code?: string) {
  return error(400, "VALIDATION_FAILED", "Invalid request data", [{ field, message, code }]);
}

export function idParam(config: AxiosRequestConfig): string {
  const params = (config as Record<string, unknown>)._mockParams as Record<string, string>;
  return decodeURIComponent(params.id ?? "");
}

export function readParams(config: AxiosRequestConfig): URLSearchParams {
  if (config.params instanceof URLSearchParams) return new URLSearchParams(config.params);
  return new URLSearchParams(config.url?.split("?")[1] ?? "");
}

/** Body JSON của request mock (axios có thể đã stringify). */
export function readBody(config: AxiosRequestConfig): Record<string, unknown> {
  let parsed: unknown = config.data;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = {};
    }
  }
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

/** Chuỗi đã trim trong body; không phải chuỗi / rỗng → "". */
export function bodyString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function findOrder(id: string): Promise<Order | undefined> {
  const { orders } = await import("@/lib/mock-data");
  return orders.find((o) => o.orderId === id);
}
