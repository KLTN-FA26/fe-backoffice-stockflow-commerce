/**
 * Đơn bán (module 14/17) — enum wire của BE + nhãn hiển thị. Nguồn: BE develop
 * `order/api/*.java` (SCRUM-423 release, SCRUM-427 credit hold, SCRUM-460 payment status).
 * Production order: enum của BE `order/internal/domain/ProductionOrderStatus.java` (docs 17 §5.3).
 */

/** BE `order/api/PaymentTerm.java` — phương thức thanh toán của đơn (docs 14 §4.3 bước 12). */
export const ORDER_PAYMENT_TERMS = ["PREPAID", "DEPOSIT", "CREDIT"] as const;

// BalancePolicy (BE PR #150, có ON_CREDIT): `ORDER_BALANCE_POLICIES` ở `labels-order.ts`.

export const ORDER_PAYMENT_TERM_LABELS = {
  PREPAID: "Trả trước 100%",
  DEPOSIT: "Đặt cọc",
  CREDIT: "Công nợ",
} as const satisfies Record<OrderPaymentTerm, string>;

/**
 * BE `order/api/PaymentStatus.java` — phái sinh từ số tiền đã thu (docs 15 §5.2), không phải
 * trạng thái đơn. Giá trị hiển thị Title Case để tra màu/nhãn ở `lib/status-map.ts`.
 */
export const ORDER_PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID", "ON_CREDIT", "PAID"] as const;

/** Giá trị BE ngoài `ORDER_PAYMENT_STATUSES` khi đọc — hiển thị "Không rõ" (lib/status-map). */
export const ORDER_PAYMENT_STATUS_UNKNOWN = "UNKNOWN";

export const ORDER_PAYMENT_READ_STATUSES = [
  ...ORDER_PAYMENT_STATUSES,
  ORDER_PAYMENT_STATUS_UNKNOWN,
] as const;

export const ORDER_PAYMENT_STATUS_DISPLAY = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially Paid",
  ON_CREDIT: "On Credit",
  PAID: "Paid",
  // Tra màu muted + nhãn "Không rõ" ở lib/status-map.ts
  UNKNOWN: "UNKNOWN",
} as const satisfies Record<OrderPaymentReadStatus, string>;

/** BE `order/api/CancellationReasonCode.java`. */
export const ORDER_CANCELLATION_REASON_CODES = [
  "CUSTOMER_REQUEST",
  "PAYMENT_NOT_RECEIVED",
  "PAYMENT_FAILED",
  "OUT_OF_STOCK",
  "SUSPECTED_FRAUD",
  "CREDIT_REJECTED",
  "DUPLICATE_ORDER",
  "PRODUCTION_ISSUE",
  "OTHER",
] as const;

export const ORDER_CANCELLATION_REASON_LABELS = {
  CUSTOMER_REQUEST: "Khách yêu cầu",
  PAYMENT_NOT_RECEIVED: "Chưa nhận được thanh toán",
  PAYMENT_FAILED: "Thanh toán thất bại",
  OUT_OF_STOCK: "Hết hàng, không thể giao",
  SUSPECTED_FRAUD: "Nghi gian lận",
  CREDIT_REJECTED: "Kế toán từ chối duyệt công nợ",
  DUPLICATE_ORDER: "Đơn trùng",
  PRODUCTION_ISSUE: "Sự cố sản xuất",
  OTHER: "Lý do khác",
} as const satisfies Record<OrderCancellationReasonCode, string>;

/**
 * Đơn sản xuất — BE `order/internal/domain/ProductionOrderStatus.java` (`GET /production-orders`), vòng đời
 * docs 17 §5.3: Draft → Sent → Accepted → Sample Pending → In Production → Partially Received / Received; Cancelled
 * (trước khi in hàng loạt) và Closed (đóng thiếu) là terminal. `PENDING_APPROVAL` giữ để đọc lịch sử trạng thái đơn
 * cũ — bỏ bước duyệt từ 2026-11-20 (docs 17 BR-23 chốt lại), BE không còn đơn nào ở trạng thái này.
 */
export const PRODUCTION_ORDER_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "SENT",
  "ACCEPTED",
  "SAMPLE_PENDING",
  "IN_PRODUCTION",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
  "CLOSED",
] as const;

/**
 * BR-15 (docs 03 §6): trạng thái Đơn sản xuất nhận được hàng. `SENT` / `ACCEPTED` chỉ nhận khi Đơn sản xuất **không**
 * bật cờ duyệt mẫu in (`sampleApprovalRequired`); `SAMPLE_PENDING` luôn bị chặn. BE kiểm lại
 * (`PRODUCTION_ORDER_NOT_RECEIVABLE`).
 */
export const RECEIVABLE_PRODUCTION_ORDER_STATUSES = [
  "IN_PRODUCTION",
  "PARTIALLY_RECEIVED",
  "SENT",
  "ACCEPTED",
] as const satisfies readonly ProductionOrderStatus[];

/** BR-15: hai trạng thái chỉ nhận được khi Đơn sản xuất không chờ khách duyệt mẫu in. */
export const SAMPLE_GATED_PRODUCTION_ORDER_STATUSES = [
  "SENT",
  "ACCEPTED",
] as const satisfies readonly ProductionOrderStatus[];

/** Chuỗi nguyên văn docs 17 §5.3 — tra tone ở `lib/status-map.ts`. */
export const PRODUCTION_ORDER_STATUS_DISPLAY = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  SAMPLE_PENDING: "Sample Pending",
  IN_PRODUCTION: "In Production",
  PARTIALLY_RECEIVED: "Partially Received",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
  CLOSED: "Closed",
} as const satisfies Record<ProductionOrderStatus, string>;

/** Nhãn của Đơn sản xuất — "Sent"/"Accepted" ở đây là gửi / được đơn vị sản xuất nhận, không phải khách. */
export const PRODUCTION_ORDER_STATUS_LABELS = {
  DRAFT: "Nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  SENT: "Đã gửi đơn vị sản xuất",
  ACCEPTED: "Đơn vị sản xuất đã nhận",
  SAMPLE_PENDING: "Chờ duyệt mẫu in",
  IN_PRODUCTION: "Đang sản xuất",
  PARTIALLY_RECEIVED: "Đã nhập kho một phần",
  RECEIVED: "Đã nhập kho đủ",
  CANCELLED: "Đã huỷ",
  CLOSED: "Đã đóng",
} as const satisfies Record<ProductionOrderStatus, string>;

export type OrderPaymentTerm = (typeof ORDER_PAYMENT_TERMS)[number];
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[number];
export type OrderPaymentReadStatus = (typeof ORDER_PAYMENT_READ_STATUSES)[number];
/** Hợp đồng mua bán — BE `SalesContractStatus` (docs 14 §5, origin/develop 438fe6fb). */
/**
 * BE `SalesContractStatus`. LIQUIDATED (WF-05 Q-6, BE-06, F-3): đơn kết thúc mà không giao được gì (hãng hoàn toàn bộ,
 * thất lạc toàn bộ, huỷ sau khi ký) và đã xong tiền — hợp đồng "Thanh lý", không bao giờ "Hoàn tất".
 */
export const SALES_CONTRACT_STATUSES = [
  "DRAFT",
  "SENT",
  "CUSTOMER_SIGNED",
  "SIGNED",
  "COMPLETED",
  "LIQUIDATED",
  "CANCELLED",
] as const;
export type SalesContractStatus = (typeof SALES_CONTRACT_STATUSES)[number];
/** Trạng thái hợp đồng sau khi đọc: giá trị BE thêm sau → "UNKNOWN" ("Không rõ", không thao tác) — WF-05 BO-11. */
export type SalesContractReadStatus = SalesContractStatus | "UNKNOWN";
export const SALES_CONTRACT_STATUS_LABELS = {
  DRAFT: "Nháp",
  SENT: "Đã gửi",
  CUSTOMER_SIGNED: "Khách đã ký",
  SIGNED: "Đã ký",
  COMPLETED: "Hoàn tất",
  LIQUIDATED: "Thanh lý",
  CANCELLED: "Đã huỷ",
  UNKNOWN: "Không rõ",
} as const satisfies Record<SalesContractReadStatus, string>;
/** Tone (status-map) cho chấm trạng thái hợp đồng. */
export const SALES_CONTRACT_STATUS_TONE_KEY = {
  DRAFT: "Draft",
  SENT: "Sent",
  CUSTOMER_SIGNED: "CUSTOMER_SIGNED",
  SIGNED: "Confirmed",
  COMPLETED: "Completed",
  LIQUIDATED: "Closed",
  CANCELLED: "Cancelled",
  UNKNOWN: "UNKNOWN",
} as const satisfies Record<SalesContractReadStatus, string>;
/** Hợp đồng đã ký (còn hiệu lực hoặc đã kết thúc sau khi ký) — có bản đã ký, có đợt thanh toán thật. */
export const SALES_CONTRACT_SIGNED_STATUSES = [
  "SIGNED",
  "COMPLETED",
  "LIQUIDATED",
] as const satisfies readonly SalesContractStatus[];
/** Mốc đợt thanh toán của hợp đồng — BE `PaymentMilestone` (không gồm phí huỷ). */
export const CONTRACT_MILESTONES = ["ON_SIGNING", "BEFORE_DELIVERY", "AFTER_DELIVERY"] as const;
export type ContractMilestone = (typeof CONTRACT_MILESTONES)[number];
export const CONTRACT_MILESTONE_LABELS = {
  ON_SIGNING: "Khi ký",
  BEFORE_DELIVERY: "Trước giao",
  AFTER_DELIVERY: "Sau giao",
} as const satisfies Record<ContractMilestone, string>;

export type OrderCancellationReasonCode = (typeof ORDER_CANCELLATION_REASON_CODES)[number];
export type ProductionOrderStatus = (typeof PRODUCTION_ORDER_STATUSES)[number];
