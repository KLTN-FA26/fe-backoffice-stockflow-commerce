export const PO_STATUSES = [
  "DRAFT",
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
  "CLOSED",
  "CLOSED_SHORT",
  "CANCELLED",
] as const;

export const PO_STATUS = {
  DRAFT: "DRAFT",
  APPROVED: "APPROVED",
  SENT: "SENT",
  PARTIALLY_RECEIVED: "PARTIALLY_RECEIVED",
  CLOSED: "CLOSED",
  CLOSED_SHORT: "CLOSED_SHORT",
  CANCELLED: "CANCELLED",
} as const satisfies Record<string, PoStatus>;

/** BE `SupplierConfirmationStatus` — NCC đã phản hồi PO chưa. */
export const SUPPLIER_CONFIRMATION_STATUSES = [
  "NOT_SENT",
  "PENDING",
  "CONFIRMED",
  "REJECTED",
] as const;

export const SUPPLIER_CONFIRMATION_STATUS = {
  NOT_SENT: "NOT_SENT",
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
} as const satisfies Record<string, SupplierConfirmationStatus>;

/** BE `PurchaseOrderController.deliveryStatus` — gom từ notification log (BE #36). */
export const PO_DELIVERY_STATUSES = [
  "NOT_SENT",
  "QUEUED",
  "UNKNOWN",
  "RETRYING",
  "FAILED",
  "DELIVERED",
  "SUPPRESSED",
] as const;

export const PO_DELIVERY_STATUS = {
  NOT_SENT: "NOT_SENT",
  QUEUED: "QUEUED",
  UNKNOWN: "UNKNOWN",
  RETRYING: "RETRYING",
  FAILED: "FAILED",
  DELIVERED: "DELIVERED",
  SUPPRESSED: "SUPPRESSED",
} as const satisfies Record<string, PoDeliveryStatus>;

/**
 * BE #36 (9fbb90f) `PurchaseOrderResponse.cancellationDeliveryStatus` — thông báo huỷ gửi tới NCC
 * khi PO đã gửi rồi mới huỷ. NOT_REQUIRED: huỷ trước khi gửi, không cần báo.
 */
export const PO_CANCELLATION_DELIVERY_STATUSES = [
  "NOT_REQUIRED",
  "UNKNOWN",
  "QUEUED",
  "RETRYING",
  "FAILED",
  "DELIVERED",
] as const;

export const PO_CANCELLATION_DELIVERY_STATUS = {
  NOT_REQUIRED: "NOT_REQUIRED",
  UNKNOWN: "UNKNOWN",
  QUEUED: "QUEUED",
  RETRYING: "RETRYING",
  FAILED: "FAILED",
  DELIVERED: "DELIVERED",
} as const satisfies Record<string, PoCancellationDeliveryStatus>;

/** BE notification `DeliveryStatus` — kết quả từng lần gửi (`GET …/deliveries`). */
export const PO_DELIVERY_ATTEMPT_STATUSES = ["PENDING", "SENT", "FAILED"] as const;

export const PO_DELIVERY_ATTEMPT_STATUS = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
} as const satisfies Record<string, PoDeliveryAttemptStatus>;

export const PROPOSAL_STATUSES = ["Draft Proposal", "Reviewed", "Converted"] as const;

/** Trạng thái phiếu nhận — nguyên văn docs 03 §5.1 (6 trạng thái, thứ tự vòng đời). */
export const RECEIPT_STATUSES = [
  "Draft",
  "Confirmed",
  "In QC",
  "In Putaway",
  "Closed",
  "Cancelled",
] as const;

export const RECEIPT_STATUS = {
  CANCELLED: "Cancelled",
  CLOSED: "Closed",
  CONFIRMED: "Confirmed",
  DRAFT: "Draft",
  IN_PUTAWAY: "In Putaway",
  IN_QC: "In QC",
} as const satisfies Record<string, ReceiptStatus>;

/** Mã trạng thái BE `GoodsReceiptStatus` (PR #62, SCRUM-435) — map 1-1 với `RECEIPT_STATUSES`. */
export const RECEIPT_API_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "IN_QC",
  "IN_PUTAWAY",
  "CLOSED",
  "CANCELLED",
] as const;

/** BE ↔ FE cho trạng thái phiếu nhận. Đảo chiều qua `RECEIPT_API_STATUS_BY_STATUS`. */
export const RECEIPT_STATUS_BY_API = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  IN_QC: "In QC",
  IN_PUTAWAY: "In Putaway",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
} as const satisfies Record<ReceiptApiStatus, ReceiptStatus>;

export const RECEIPT_API_STATUS_BY_STATUS = {
  Draft: "DRAFT",
  Confirmed: "CONFIRMED",
  "In QC": "IN_QC",
  "In Putaway": "IN_PUTAWAY",
  Closed: "CLOSED",
  Cancelled: "CANCELLED",
} as const satisfies Record<ReceiptStatus, ReceiptApiStatus>;

/**
 * Tiến độ QC của một dòng nhận — BE `GoodsReceipts.QcProgress` (luồng 3 bước, docs 03 §5.2).
 * Docs gộp AWAITING_MOVE_TO_QC + IN_QC_AREA thành `Pending`; FE giữ mã BE để gate action dòng.
 */
export const RECEIPT_QC_PROGRESS_API = [
  "NOT_REQUIRED",
  "AWAITING_MOVE_TO_QC",
  "IN_QC_AREA",
  "INSPECTED",
] as const;

/** Nhãn hiển thị (nguyên văn docs 03 §5.2) cho tiến độ QC chưa có kết luận. */
export const RECEIPT_QC_PROGRESS_STATUS = {
  NOT_REQUIRED: "Not Required",
  AWAITING_MOVE_TO_QC: "Pending",
  IN_QC_AREA: "Pending",
} as const satisfies Partial<Record<ReceiptQcProgressApi, string>>;

/** Kết luận QC — BE `QcOutcome` ↔ docs 03 §5.2. */
export const QC_OUTCOME_API = ["ACCEPTED", "QUARANTINE", "REJECTED"] as const;

export const QC_OUTCOME_STATUSES = ["Accepted", "Quarantine", "Rejected"] as const;

export const QC_OUTCOME_BY_API = {
  ACCEPTED: "Accepted",
  QUARANTINE: "Quarantine",
  REJECTED: "Rejected",
} as const satisfies Record<QcOutcomeApi, QcOutcomeStatus>;

export const PRODUCT_STATUSES = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Active",
  "Published",
  "Inactive",
  "Discontinued",
] as const;

export const PRODUCT_STATUS = {
  ACTIVE: "Active",
  APPROVED: "Approved",
  DISCONTINUED: "Discontinued",
  DRAFT: "Draft",
  INACTIVE: "Inactive",
  PENDING_APPROVAL: "Pending Approval",
  PUBLISHED: "Published",
} as const satisfies Record<string, ProductStatus>;

export const SKU_STATUSES = ["Active", "Blocked", "Obsolete"] as const;

export const SKU_STATUS = {
  ACTIVE: "Active",
  BLOCKED: "Blocked",
  OBSOLETE: "Obsolete",
} as const satisfies Record<string, SkuStatus>;

export const INVOICE_STATUSES = [
  "Draft",
  "Matched",
  "Exception",
  "Disputed",
  "Approved for Payment",
  "Paid",
  "Cancelled",
] as const;

export const INVOICE_STATUS = {
  APPROVED_FOR_PAYMENT: "Approved for Payment",
  CANCELLED: "Cancelled",
  DISPUTED: "Disputed",
  DRAFT: "Draft",
  EXCEPTION: "Exception",
  MATCHED: "Matched",
  PAID: "Paid",
} as const satisfies Record<string, InvoiceStatus>;

/**
 * Order — đúng 10 trạng thái của BE `order/api/OrderStatus.java`, ánh xạ 1-1 với mã wire
 * (PENDING_PAYMENT ↔ "Pending Payment"…, xem features/order/status-map.ts).
 *
 * QUYẾT ĐỊNH (lệch quy tắc "docs thắng" của CLAUDE.md, chủ đích cho module order): FE khớp BE,
 * KHÔNG dựng theo 20 trạng thái của docs 17 §5 — docs tách nhiều bước (Picking, Packed,
 * In Production…) mà BE không có, hiển thị chúng là hứa trạng thái BE không bao giờ trả.
 * mock-data.ts vẫn dùng 20 trạng thái docs; route mock gộp về 10 trạng thái BE trước khi trả.
 */
export const ORDER_STATUSES = [
  "Draft",
  "Pending Payment",
  "Paid",
  "In Fulfilment",
  "On Hold",
  "Shipped",
  "Delivered",
  "Completed",
  "Cancelled",
  "Returned",
] as const;

/** Nhà cung cấp (module 01) — BE: ACTIVE/INACTIVE (SCRUM-118). */
export const SUPPLIER_STATUSES = ["Active", "Inactive"] as const;

export const SUPPLIER_STATUS = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
} as const satisfies Record<string, SupplierStatus>;

/** Giá trị status trên wire của BE (SaveSupplierRequest/SupplierResponse — BE PR #36). */
export const SUPPLIER_API_STATUSES = ["ACTIVE", "INACTIVE"] as const;

/** Kênh gửi PO cho NCC — BE `communicationChannel` (EMAIL|API, BE PR #36). */
export const SUPPLIER_CHANNELS = ["EMAIL", "API"] as const;

export type PoStatus = (typeof PO_STATUSES)[number];
export type SupplierConfirmationStatus = (typeof SUPPLIER_CONFIRMATION_STATUSES)[number];
export type PoDeliveryStatus = (typeof PO_DELIVERY_STATUSES)[number];
export type PoCancellationDeliveryStatus = (typeof PO_CANCELLATION_DELIVERY_STATUSES)[number];
export type PoDeliveryAttemptStatus = (typeof PO_DELIVERY_ATTEMPT_STATUSES)[number];
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];
export type ReceiptApiStatus = (typeof RECEIPT_API_STATUSES)[number];
export type ReceiptQcProgressApi = (typeof RECEIPT_QC_PROGRESS_API)[number];
export type QcOutcomeApi = (typeof QC_OUTCOME_API)[number];
export type QcOutcomeStatus = (typeof QC_OUTCOME_STATUSES)[number];
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export type SkuStatus = (typeof SKU_STATUSES)[number];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];
export type SupplierApiStatus = (typeof SUPPLIER_API_STATUSES)[number];
export type SupplierChannel = (typeof SUPPLIER_CHANNELS)[number];
