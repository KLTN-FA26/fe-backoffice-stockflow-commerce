/**
 * Thanh toán theo hợp đồng & công nợ (docs ecommerce/15-payment) — hằng số của màn Kế toán:
 * đợt thanh toán, phiếu thu, hoàn tiền. Một file riêng (như `inventory.ts`) để import trực tiếp
 * `@/constants/payment`, không chạm các file hằng số chung.
 */

/* ── Quyền (BE `PaymentResources`, seed V20261108002400 + V20261108003000) ───────────────── */

/**
 * Đợt thanh toán — resource `payment-installments`: VIEW_PAGE + READ cho Kế toán, Sales (xem để gửi
 * thông tin chuyển khoản / nhắc nợ) và Quản trị hệ thống. Không có action ghi: đợt do hệ thống sinh.
 */
export const PAYMENT_INSTALLMENT_PERMISSIONS = {
  viewPage: "payment-installments:VIEW_PAGE",
  read: "payment-installments:READ",
} as const;

/**
 * Phiếu thu — resource `payment-receipts`: CREATE = lập phiếu thu (`POST /payment-receipts`),
 * UPDATE = huỷ phiếu thu ghi sai (`POST /payment-receipts/{id}/void`). Seed: Kế toán + Quản trị hệ thống.
 */
export const PAYMENT_RECEIPT_PERMISSIONS = {
  viewPage: "payment-receipts:VIEW_PAGE",
  read: "payment-receipts:READ",
  create: "payment-receipts:CREATE",
  update: "payment-receipts:UPDATE",
} as const;

/**
 * Hoàn tiền — resource `payment-refunds`: CREATE = ghi nhận đã hoàn, UPDATE = huỷ ghi nhận ghi sai.
 * Seed: Kế toán + Quản trị hệ thống đủ 4 action; Sales chỉ VIEW_PAGE + READ (theo dõi để trả lời khách).
 * Định nghĩa duy nhất nằm ở `./permissions` (màn đơn cũng đọc cùng resource), re-export ở đây cho màn Kế toán.
 */
export { PAYMENT_REFUND_PERMISSIONS } from "./permissions";

/* ── Route ───────────────────────────────────────────────────────────────────────────────── */

const PAYMENT_BASE = "/admin/payment";

export const PAYMENT_ROUTES = {
  installments: {
    list: `${PAYMENT_BASE}/installments`,
    detail: (id: string) => `${PAYMENT_BASE}/installments/${encodeURIComponent(id)}`,
    /** Các đợt của một đơn (docs 15 §5.2) — segment tĩnh `orders` ưu tiên hơn `[id]`. */
    ofOrder: (orderId: string) =>
      `${PAYMENT_BASE}/installments/orders/${encodeURIComponent(orderId)}`,
    byCustomer: (customerId: string) =>
      `${PAYMENT_BASE}/installments?customerId=${encodeURIComponent(customerId)}`,
    /** Công nợ phải thu (docs 15 §4.3 bước 8): đợt `AFTER_DELIVERY` đã đến mốc. */
    receivables: `${PAYMENT_BASE}/installments?milestone=AFTER_DELIVERY&reached=true`,
  },
  receipts: {
    list: `${PAYMENT_BASE}/receipts`,
    detail: (id: string) => `${PAYMENT_BASE}/receipts/${encodeURIComponent(id)}`,
  },
  refunds: {
    list: `${PAYMENT_BASE}/refunds`,
    ofOrder: (orderId: string) => `${PAYMENT_BASE}/refunds/${encodeURIComponent(orderId)}`,
  },
} as const;

/* ── Trạng thái (docs 15 §5.1, §5.2, §5.3 — nguyên văn) ─────────────────────────────────── */

/** BE `InstallmentStatus`; `Cancelled` bổ sung ngoài danh sách đã chốt (docs 15 §5.1, 2026-11-05). */
export const INSTALLMENT_API_STATUSES = [
  "NOT_DUE",
  "DUE",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;
export type InstallmentApiStatus = (typeof INSTALLMENT_API_STATUSES)[number];
export const INSTALLMENT_STATUS_BY_API = {
  NOT_DUE: "Not Due",
  DUE: "Due",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
} as const satisfies Record<InstallmentApiStatus, string>;

/**
 * Mốc của đợt — BE `InstallmentMilestone`. `CANCELLATION_FEE` không phải mốc của lịch: là khoản phí
 * huỷ còn thiếu (docs 15 §4.6 bước 18), thu như một đợt.
 */
export const INSTALLMENT_MILESTONES = [
  "ON_SIGNING",
  "BEFORE_DELIVERY",
  "AFTER_DELIVERY",
  "CANCELLATION_FEE",
] as const;
export type InstallmentMilestone = (typeof INSTALLMENT_MILESTONES)[number];

/** Trạng thái đợt còn nhận tiền: chưa `Paid` / `Cancelled` (docs 15 BR-05; BE `InstallmentStatus.takesMoney`). */
export const INSTALLMENT_PAYABLE_STATUSES = [
  "NOT_DUE",
  "DUE",
  "PARTIALLY_PAID",
  "OVERDUE",
] as const satisfies readonly InstallmentApiStatus[];

/** Phiếu thu và ghi nhận hoàn (docs 15 §5.3): `Recorded` → `Voided`. */
export const RECEIPT_API_STATUSES = ["RECORDED", "VOIDED"] as const;
export type ReceiptApiStatus = (typeof RECEIPT_API_STATUSES)[number];
export const RECEIPT_STATUS_BY_API = {
  RECORDED: "Recorded",
  VOIDED: "Voided",
} as const satisfies Record<ReceiptApiStatus, string>;

/** Trạng thái thanh toán của đơn — tính từ các đợt, không lưu (docs 15 §5.2). */
export const ORDER_PAYMENT_API_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID"] as const;
export type OrderPaymentApiStatus = (typeof ORDER_PAYMENT_API_STATUSES)[number];
export const ORDER_PAYMENT_STATUS_BY_API = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
} as const satisfies Record<OrderPaymentApiStatus, string>;

/** Tình trạng hoàn tiền của đơn — tính ra, không lưu (docs 15 §5.3). */
export const REFUND_API_STATUSES = ["NONE", "PENDING", "PARTIALLY_REFUNDED", "REFUNDED"] as const;
export type RefundApiStatus = (typeof REFUND_API_STATUSES)[number];

/** Nguồn của một lần tính hoàn (BE `OrderSettlement.Kind`; docs 15 §4.5, §4.6): huỷ đơn, đóng phần còn lại, trả hàng. */
export const SETTLEMENT_KINDS = ["ORDER_CANCELLED", "REMAINDER_CLOSED", "GOODS_RETURNED"] as const;
export type SettlementKind = (typeof SETTLEMENT_KINDS)[number];

/* ── Giới hạn (BE `RecordReceiptRequest`, `VoidReceiptRequest`, `RecordRefundRequest`) ────── */

export const PAYMENT_LIMITS = {
  /** `reference` ≤ 100 ký tự (docs 15 §3, BR-03). */
  referenceMax: 100,
  /** Ký tự cho phép của mã tham chiếu sao kê: chữ, số, khoảng trắng và `. _ / : # -`. */
  referencePattern: /^[\p{L}\p{N} ._/:#-]+$/u,
  /** `note` ≤ 500. */
  noteMax: 500,
  /** Lý do huỷ phiếu thu / huỷ ghi nhận hoàn ≤ 500 (docs 15 §3). */
  reasonMax: 500,
  /** Một phiếu thu tối đa 100 dòng. */
  linesMax: 100,
  /** Số tiền mỗi dòng: số nguyên đồng ≥ 1, tối đa 15 chữ số. */
  amountMin: 1,
  amountDigitsMax: 15,
  /** Trần `size` của BE (`Pages.MAX_PAGE_SIZE`). */
  pageSizeMax: 200,
} as const;

/**
 * Khoá localStorage của cấu hình trang (số dòng / trang). Bộ lọc nằm trên URL (state-persistence.md).
 * Để ở file này thay vì `STORAGE_KEYS` để không chạm hằng số chung.
 */
export const PAYMENT_STORAGE_KEYS = {
  installmentsConfig: "stockflow:admin:payment:installments:config",
  receiptsConfig: "stockflow:admin:payment:receipts:config",
  refundsConfig: "stockflow:admin:payment:refunds:config",
} as const;
