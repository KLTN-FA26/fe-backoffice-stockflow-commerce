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
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export type SkuStatus = (typeof SKU_STATUSES)[number];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];
export type SupplierApiStatus = (typeof SUPPLIER_API_STATUSES)[number];
export type SupplierChannel = (typeof SUPPLIER_CHANNELS)[number];
