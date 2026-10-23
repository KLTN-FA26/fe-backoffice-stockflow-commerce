/**
 * Đơn bán (module 14/17) — enum wire của BE + nhãn hiển thị. Nguồn: BE develop
 * `order/api/*.java` (SCRUM-423 release, SCRUM-427 credit hold, SCRUM-460 payment status).
 * Production order: enum của BE `production/domain/ProductionOrder.java` (ProductionOrderRowResponse).
 */

/** BE `order/api/PaymentTerm.java` — phương thức thanh toán của đơn (docs 14 §4.3 bước 12). */
export const ORDER_PAYMENT_TERMS = ["PREPAID", "DEPOSIT", "CREDIT"] as const;

/**
 * BE `order/api/BalancePolicy.java` — đơn cọc thu phần còn lại trước khi giao (chuyển khoản) hay hãng
 * vận chuyển thu khi giao (G2-3). null với phương thức khác.
 */
export const ORDER_BALANCE_POLICIES = ["BEFORE_DELIVERY", "ON_DELIVERY"] as const;

export const ORDER_BALANCE_POLICY_LABELS = {
  BEFORE_DELIVERY: "Chuyển khoản trước khi giao",
  ON_DELIVERY: "Hãng vận chuyển thu khi giao",
} as const satisfies Record<(typeof ORDER_BALANCE_POLICIES)[number], string>;

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

/** BE `CreditHoldService.RefusalAction` — xử lý khi từ chối duyệt vượt hạn mức (docs 15 §4.3). */
export const CREDIT_REJECTION_ACTIONS = [
  "CANCEL",
  "SWITCH_TO_PREPAID",
  "SWITCH_TO_DEPOSIT",
] as const;

export const CREDIT_REJECTION_ACTION_LABELS = {
  CANCEL: "Huỷ đơn",
  SWITCH_TO_PREPAID: "Chuyển sang trả trước 100%",
  SWITCH_TO_DEPOSIT: "Chuyển sang đặt cọc",
} as const satisfies Record<CreditRejectionAction, string>;

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
export type OrderCancellationReasonCode = (typeof ORDER_CANCELLATION_REASON_CODES)[number];
export type CreditRejectionAction = (typeof CREDIT_REJECTION_ACTIONS)[number];
export type ProductionOrderStatus = (typeof PRODUCTION_ORDER_STATUSES)[number];
export type ProductionOrderMode = (typeof PRODUCTION_ORDER_MODES)[number];
