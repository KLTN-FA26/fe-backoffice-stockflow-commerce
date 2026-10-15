/**
 * Mock đơn bán — store in-memory + chuyển mock-data → wire BE `OrderResponse`, dùng chung cho
 * `mock-routes-orders.ts` (list/detail/history/huỷ), `mock-routes-orders-actions.ts`
 * (release, credit hold, lệnh sản xuất) và mock xuất kho `mock-routes-fulfillment*.ts` (đổi trạng
 * thái đơn, snapshot + checksum thiết kế). Một nguồn duy nhất cho trạng thái đơn đã đổi trong phiên.
 *
 * mock-data (không được sửa) dùng 20 trạng thái docs 17 và chưa có phương thức thanh toán B2B,
 * hạn mức công nợ hay lệnh sản xuất. Mọi suy diễn dưới đây là ASSUMPTION mock-only — chỉ GÁN
 * THUỘC TÍNH cho đơn có sẵn theo quy tắc, không thêm bản ghi đơn mới.
 */

import type { AxiosRequestConfig } from "axios";
import type { Order, OrderLine, OrderManagementStatus } from "@/lib/mock-data";

export type BeOrderStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "IN_PRODUCTION"
  | "READY_TO_FULFILL"
  | "IN_FULFILMENT"
  | "ON_HOLD"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "RETURNED";
export type BePaymentTerm = "PREPAID" | "DEPOSIT" | "CREDIT";

/** Gộp 20 trạng thái docs về trạng thái BE gần nhất (BE OrderStatus.java develop). */
export const MOCK_TO_BACKEND_STATUS: Record<OrderManagementStatus, BeOrderStatus> = {
  "Pending Payment": "PENDING_PAYMENT",
  // BE: PENDING_PAYMENT ──paymentFailed──▶ CANCELLED (OrderStatus.java javadoc)
  "Payment Failed": "CANCELLED",
  Confirmed: "CONFIRMED",
  "In Production": "IN_PRODUCTION",
  "Ready to Fulfill": "READY_TO_FULFILL",
  Picking: "IN_FULFILMENT",
  Packed: "IN_FULFILMENT",
  "Partially Fulfilled": "IN_FULFILMENT",
  "On Hold": "ON_HOLD",
  Shipped: "SHIPPED",
  "In Transit": "SHIPPED",
  "Delivery Failed": "SHIPPED",
  Delivered: "DELIVERED",
  "Return Requested": "DELIVERED",
  Completed: "COMPLETED",
  Closed: "COMPLETED",
  Cancelled: "CANCELLED",
  Returned: "RETURNED",
  Refunded: "RETURNED",
  "Partially Refunded": "RETURNED",
};

/** BE `OrderStatus#canTransitionTo(CANCELLED)` — BR-031: từ SHIPPED trở đi không huỷ. */
export const CANCELLABLE_STATUSES: readonly BeOrderStatus[] = [
  "DRAFT",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY_TO_FULFILL",
  "IN_FULFILMENT",
  "ON_HOLD",
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

export interface MockHistoryEntry {
  from: BeOrderStatus | null;
  to: BeOrderStatus;
  reason: string | null;
  occurredAt: string;
}

interface OrderOverride {
  status?: BeOrderStatus;
  paymentTerm?: BePaymentTerm;
  /** % cọc chốt khi từ chối công nợ → đặt cọc (BE CreditRefusalRequest.depositPercent). */
  depositPercent?: number;
  warehouseId?: string;
  releasedAt?: string;
  cancellation?: { reasonCode: string; reason: string | null; retainedAmount: number };
  /** Bước lịch sử phát sinh trong phiên mock (release, duyệt công nợ, huỷ). */
  history: MockHistoryEntry[];
}

const overrides = new Map<string, OrderOverride>();

export function resetOrderMockStore(): void {
  overrides.clear();
}

export function backendStatus(order: Order): BeOrderStatus {
  return overrides.get(order.orderId)?.status ?? MOCK_TO_BACKEND_STATUS[order.status];
}

/** Trạng thái BE hiện tại của một đơn mock — cho mock xuất kho (`requireOrderInFulfilment`). */
export async function backendOrderStatusOf(orderId: string): Promise<BeOrderStatus | undefined> {
  const order = await findOrder(orderId);
  return order ? backendStatus(order) : undefined;
}

/** Mock xuất kho đổi trạng thái đơn như BE (vào xuất kho, giữ / gỡ giữ do lệch thiết kế). */
export function setMockOrderStatus(orderId: string, status: BeOrderStatus): void {
  overrides.set(orderId, { ...(overrides.get(orderId) ?? { history: [] }), status });
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

export function paymentTermOf(order: Order): BePaymentTerm {
  return overrides.get(order.orderId)?.paymentTerm ?? deriveTerm(order);
}

export function sessionHistory(orderId: string): readonly MockHistoryEntry[] {
  return overrides.get(orderId)?.history ?? [];
}

/** Ghi một bước chuyển trạng thái (+ thay đổi đi kèm) vào store, như BE lưu status change. */
export function applyTransition(
  order: Order,
  to: BeOrderStatus,
  reason: string | null,
  patch: Omit<OrderOverride, "status" | "history"> = {},
): void {
  const current = overrides.get(order.orderId) ?? { history: [] };
  const from = backendStatus(order);
  overrides.set(order.orderId, {
    ...current,
    ...patch,
    status: to,
    history: [...current.history, { from, to, reason, occurredAt: new Date().toISOString() }],
  });
}

function paymentStatus(term: BePaymentTerm, paid: number, total: number) {
  if (paid >= total && total > 0) return "PAID";
  if (term === "CREDIT") return "ON_CREDIT";
  return paid > 0 ? "PARTIALLY_PAID" : "UNPAID";
}

/** mock-data `Order` → BE `OrderResponse`. Chỉ field có trong hợp đồng BE develop. */
export function toOrderResponse(order: Order) {
  const override = overrides.get(order.orderId);
  const term = paymentTermOf(order);
  const status = backendStatus(order);
  const released =
    override?.warehouseId ??
    // Đơn đã qua release trong mock-data (sản xuất / kho / giao) mang kho xử lý sẵn có
    ([
      "IN_PRODUCTION",
      "READY_TO_FULFILL",
      "IN_FULFILMENT",
      "SHIPPED",
      "DELIVERED",
      "COMPLETED",
      "RETURNED",
    ].includes(status)
      ? order.fulfillmentWarehouseId
      : null);
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
      reservationIds: CANCELLABLE_STATUSES.includes(status) ? [`RSV-${line.lineId}`] : [],
      designSnapshotId: isCustomLine(line) ? snapshotIdOf(line) : null,
      designChecksum: isCustomLine(line) ? lockedChecksumOf(line) : null,
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
    warehouseId: released,
    releasedAt: override?.releasedAt ?? null,
    paidAmount: order.amountPaid,
    depositRequired:
      term === "DEPOSIT"
        ? roundMoney(
            (order.grandTotal *
              (override?.depositPercent ??
                creditProfileOf(order.customerId).depositPercent ??
                // Đơn cọc nhưng khách chưa có hồ sơ — không xảy ra với bảng trên; giữ số an toàn
                30)) /
              100,
            order.currency,
          )
        : null,
    depositReceivedAt:
      term === "DEPOSIT" && order.amountPaid > 0 ? (order.confirmedAt ?? order.placedAt) : null,
    paidInFullAt: order.amountPaid >= order.grandTotal ? (order.confirmedAt ?? null) : null,
    paymentStatus: paymentStatus(term, order.amountPaid, order.grandTotal),
    // ASSUMPTION (mock-only, D13): kỳ hạn công nợ 30 ngày
    creditTermDays: term === "CREDIT" ? 30 : null,
    cancellation: override?.cancellation ?? null,
  };
}

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

export async function findOrder(id: string): Promise<Order | undefined> {
  const { orders } = await import("@/lib/mock-data");
  return orders.find((o) => o.orderId === id);
}
