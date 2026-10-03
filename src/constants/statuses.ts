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

/** BE notification `DeliveryStatus` — kết quả từng lần gửi (`GET …/deliveries`). */
export const PO_DELIVERY_ATTEMPT_STATUSES = ["PENDING", "SENT", "FAILED"] as const;

export const PO_DELIVERY_ATTEMPT_STATUS = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
} as const satisfies Record<string, PoDeliveryAttemptStatus>;

export const PROPOSAL_STATUSES = ["Draft Proposal", "Reviewed", "Converted"] as const;

export const RECEIPT_STATUSES = [
  "Draft",
  "Confirmed",
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
} as const satisfies Record<string, ReceiptStatus>;

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
export type PoDeliveryAttemptStatus = (typeof PO_DELIVERY_ATTEMPT_STATUSES)[number];
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export type SkuStatus = (typeof SKU_STATUSES)[number];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];
export type SupplierApiStatus = (typeof SUPPLIER_API_STATUSES)[number];
export type SupplierChannel = (typeof SUPPLIER_CHANNELS)[number];
