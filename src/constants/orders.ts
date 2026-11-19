/**
 * Đơn bán (module 14/17) — enum wire của BE + nhãn hiển thị. Nguồn: BE develop
 * `order/api/*.java` (SCRUM-423 release, SCRUM-427 credit hold, SCRUM-460 payment status).
 * Production order: enum của BE `production/domain/ProductionOrder.java` (ProductionOrderRowResponse).
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
  CREDIT_REJECTED: "Từ chối vượt hạn mức công nợ",
  DUPLICATE_ORDER: "Đơn trùng",
  PRODUCTION_ISSUE: "Sự cố sản xuất",
  OTHER: "Lý do khác",
} as const satisfies Record<OrderCancellationReasonCode, string>;

/** Ràng buộc DB `production_orders.status` (docs 19 §5.1). */
export const PRODUCTION_ORDER_STATUSES = [
  "PENDING_PREPRESS",
  "READY",
  "MATERIAL_ISSUED",
  "PRINTING",
  "SUBCONTRACTED",
  "QC",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;

/** Chuỗi nguyên văn docs 19 §5.1 — tra màu/nhãn ở `lib/status-map.ts`. */
export const PRODUCTION_ORDER_STATUS_DISPLAY = {
  PENDING_PREPRESS: "Pending Prepress",
  READY: "Ready",
  MATERIAL_ISSUED: "Material Issued",
  PRINTING: "Printing",
  SUBCONTRACTED: "Subcontracted",
  QC: "QC",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const satisfies Record<ProductionOrderStatus, string>;

/** Ràng buộc DB `production_orders.mode` — in nội bộ hay gia công ngoài (docs 19 §4.7). */
export const PRODUCTION_ORDER_MODES = ["IN_HOUSE", "SUBCONTRACTED"] as const;

export const PRODUCTION_ORDER_MODE_LABELS = {
  IN_HOUSE: "In nội bộ",
  SUBCONTRACTED: "Gia công ngoài",
} as const satisfies Record<ProductionOrderMode, string>;

/** Ràng buộc DB `production_orders.hold_reason` (docs 19 §5.1 — lý do treo lệnh). */
export const PRODUCTION_HOLD_REASON_LABELS: Record<string, string> = {
  FILE_REJECTED: "File in lỗi",
  BLANKS_SHORT: "Thiếu phôi",
  MACHINE_DOWN: "Máy hỏng",
  WAITING_CUSTOMER: "Chờ khách",
  SUBCONTRACTOR_LATE: "Nhà gia công trễ",
  OTHER: "Khác",
};

export type OrderPaymentTerm = (typeof ORDER_PAYMENT_TERMS)[number];
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[number];
export type OrderPaymentReadStatus = (typeof ORDER_PAYMENT_READ_STATUSES)[number];
/** Hợp đồng mua bán — BE `SalesContractStatus` (docs 14 §5, origin/develop 438fe6fb). */
export const SALES_CONTRACT_STATUSES = [
  "DRAFT",
  "SENT",
  "SIGNED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type SalesContractStatus = (typeof SALES_CONTRACT_STATUSES)[number];
export const SALES_CONTRACT_STATUS_LABELS = {
  DRAFT: "Nháp",
  SENT: "Đã gửi",
  SIGNED: "Đã ký",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã huỷ",
} as const satisfies Record<SalesContractStatus, string>;
/** Tone (status-map) cho chấm trạng thái hợp đồng. */
export const SALES_CONTRACT_STATUS_TONE_KEY = {
  DRAFT: "Draft",
  SENT: "Sent",
  SIGNED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const satisfies Record<SalesContractStatus, string>;
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
export type ProductionOrderMode = (typeof PRODUCTION_ORDER_MODES)[number];
