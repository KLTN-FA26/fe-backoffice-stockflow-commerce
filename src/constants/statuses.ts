export const PO_STATUSES = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Confirmed",
  "Partially Received",
  "Received",
  "Closed",
  "Cancelled",
] as const;

export const PO_STATUS = {
  APPROVED: "Approved",
  CANCELLED: "Cancelled",
  CLOSED: "Closed",
  CONFIRMED: "Confirmed",
  DRAFT: "Draft",
  PARTIALLY_RECEIVED: "Partially Received",
  PENDING_APPROVAL: "Pending Approval",
  RECEIVED: "Received",
} as const satisfies Record<string, PoStatus>;

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

/**
 * Order — superset 21 giá trị. "Draft" là MỚI (BE DRAFT), mock-data.ts hiện chưa
 * có giá trị này trong union nội bộ của nó (union đó chỉ có 20). Union này dùng
 * cho zod enum / lifecycle table / filter UI — không sửa mock-data.ts.
 */
export const ORDER_STATUSES = [
  "Draft",
  "Pending Payment",
  "Payment Failed",
  "Confirmed",
  "In Production",
  "Ready to Fulfill",
  "Picking",
  "Packed",
  "Shipped",
  "In Transit",
  "Delivered",
  "Completed",
  "Cancelled",
  "Returned",
  "Refunded",
  "Partially Refunded",
  "On Hold",
  "Partially Fulfilled",
  "Delivery Failed",
  "Return Requested",
  "Closed",
] as const;

// Chỉ đặt tên hằng cho 9 giá trị BE (order/internal/domain/OrderStatus.java) dùng
// tới; các giá trị mock-only còn lại giữ string literal ở nơi dùng.
export const ORDER_STATUS = {
  DRAFT: "Draft",
  PENDING_PAYMENT: "Pending Payment",
  CONFIRMED: "Confirmed",
  READY_TO_FULFILL: "Ready to Fulfill",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
} as const;

export type PoStatus = (typeof PO_STATUSES)[number];
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export type SkuStatus = (typeof SKU_STATUSES)[number];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
