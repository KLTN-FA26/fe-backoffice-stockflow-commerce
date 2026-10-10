/**
 * Lifecycle transition tables — ALL modules.
 *
 * Each table is the single source of truth for "which status transitions are
 * allowed" in the frontend.  The data comes from docs §5 "Trạng thái / Vòng đời"
 * tables.  When docs change, update here + tests in one commit.
 *
 * Usage:
 *   canTransition(PO_TRANSITIONS, "Draft", "Pending Approval") // true
 *   isTerminal(PO_TRANSITIONS, "Closed")                       // true
 */

/* ── Generic helpers ─────────────────────────────────────────────────── */

export function canTransition<S extends string>(
  table: Record<S, readonly S[]>,
  from: S,
  to: S,
): boolean {
  return (table[from] as readonly string[]).includes(to);
}

export function isTerminal<S extends string>(table: Record<S, readonly S[]>, status: S): boolean {
  return table[status].length === 0;
}

export function allowedTransitions<S extends string>(
  table: Record<S, readonly S[]>,
  from: S,
): readonly S[] {
  return table[from];
}

/* ── Types from mock-data ────────────────────────────────────────────── */

import type {
  ProductStatus,
  SkuStatus,
  PoStatus,
  QcStatus,
  InvoiceStatus,
  PutawayStatus,
  PickStatus,
  PackStatus,
  ShipmentStatus,
  TransferOrderStatus,
  MoveTaskStatus,
} from "@/lib/mock-data";
// OrderStatus lấy từ constants/statuses.ts (không phải mock-data) — đúng 10 trạng thái BE
// (OrderStatus.java), dùng cho zod enum / lifecycle / filter UI.
// ReceiptStatus cũng vậy — 6 trạng thái docs 03 §5.1 (mock-data chỉ có 5, thiếu "In QC").
import type { OrderStatus, ReceiptStatus } from "@/constants/statuses";

/* ── Module 01: Product ──────────────────────────────────────────────── */

// docs/warehouse/01-product-creation §5
export const PRODUCT_TRANSITIONS: Record<ProductStatus, readonly ProductStatus[]> = {
  Draft: ["Pending Approval"],
  "Pending Approval": ["Approved", "Draft"],
  Approved: ["Active"],
  Active: ["Published", "Inactive"],
  Published: ["Active", "Inactive"],
  Inactive: ["Active", "Discontinued"],
  Discontinued: [],
};

export const SKU_TRANSITIONS: Record<SkuStatus, readonly SkuStatus[]> = {
  Active: ["Blocked", "Obsolete"],
  Blocked: ["Active", "Obsolete"],
  Obsolete: [],
};

/* ── Module 02: Purchase Order ───────────────────────────────────────── */

// docs/warehouse/02-purchase-order §5
export const PO_TRANSITIONS: Record<PoStatus, readonly PoStatus[]> = {
  Draft: ["Pending Approval", "Approved", "Cancelled"],
  "Pending Approval": ["Approved", "Draft"],
  Approved: ["Confirmed", "Cancelled"],
  Confirmed: ["Partially Received", "Received", "Cancelled", "Closed"],
  "Partially Received": ["Received", "Closed"],
  Received: ["Closed"],
  Closed: [],
  Cancelled: [],
};

/* ── Module 03: Receipt ──────────────────────────────────────────────── */

// ReceiptStatus = "Draft" | "Confirmed" | "In QC" | "In Putaway" | "Closed" | "Cancelled"
// docs/warehouse/03-receipt §5.1 — bảng "Chuyển tiếp"; BE GoodsReceiptStatus (PR #62)
export const RECEIPT_TRANSITIONS: Record<ReceiptStatus, readonly ReceiptStatus[]> = {
  // BR-05: chỉ huỷ được khi chưa Confirmed; đã Confirmed thì sửa bằng điều chỉnh tồn
  Draft: ["Confirmed", "Cancelled"],
  // Có dòng cần QC → In QC, không có → In Putaway (BR-07)
  Confirmed: ["In QC", "In Putaway"],
  // Hết phần Accepted phải putaway → đi thẳng Closed
  "In QC": ["In Putaway", "Closed"],
  "In Putaway": ["Closed"],
  Closed: [],
  Cancelled: [],
};

// QcStatus = "Accepted" | "Quarantine" | "Rejected"
export const QC_TRANSITIONS: Record<QcStatus, readonly QcStatus[]> = {
  Accepted: [],
  Quarantine: ["Accepted", "Rejected"],
  Rejected: [],
};

/* ── Module 04: Invoice ──────────────────────────────────────────────── */

// InvoiceStatus = "Draft" | "Matched" | "Exception" | "Disputed" | "Approved for Payment" | "Paid" | "Cancelled"
// docs/warehouse/04-invoice §5
export const INVOICE_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  Draft: ["Matched", "Exception"],
  Matched: ["Approved for Payment"],
  Exception: ["Disputed", "Matched", "Cancelled"],
  Disputed: ["Matched", "Cancelled"],
  "Approved for Payment": ["Paid"],
  Paid: [],
  Cancelled: [],
};

/* ── Module 05: Putaway ──────────────────────────────────────────────── */

// PutawayStatus = "Pending" | "Assigned" | "In Progress" | "Partially Completed" | "On Hold" | "Completed" | "Cancelled"
// docs/warehouse/05-putaway §5
export const PUTAWAY_TRANSITIONS: Record<PutawayStatus, readonly PutawayStatus[]> = {
  Pending: ["Assigned"],
  Assigned: ["In Progress"],
  "In Progress": ["Completed", "Partially Completed", "On Hold"],
  "Partially Completed": ["In Progress", "Completed"],
  "On Hold": ["In Progress", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

/* ── Module 07: Picking ──────────────────────────────────────────────── */

// PickStatus = "Created" | "Released" | "Assigned" | "In Progress" | "Short" | "On Hold" | "Completed" | "Cancelled"
// docs/warehouse/07-picking §5
export const PICK_TRANSITIONS: Record<PickStatus, readonly PickStatus[]> = {
  Created: ["Released"],
  Released: ["Assigned"],
  Assigned: ["In Progress"],
  "In Progress": ["Completed", "Short", "On Hold"],
  Short: [],
  "On Hold": ["In Progress", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

/* ── Module 08: Packing ──────────────────────────────────────────────── */

// PackStatus = "Pending" | "In Progress" | "Verification Failed" | "On Hold" | "Packed" | "Handed to Shipping" | "Cancelled"
// docs/warehouse/08-packing §5
export const PACK_TRANSITIONS: Record<PackStatus, readonly PackStatus[]> = {
  Pending: ["In Progress"],
  "In Progress": ["Packed", "Verification Failed", "On Hold"],
  "Verification Failed": ["In Progress"],
  "On Hold": ["In Progress", "Cancelled"],
  Packed: ["Handed to Shipping"],
  "Handed to Shipping": [],
  Cancelled: [],
};

/* ── Module 09: Shipping ─────────────────────────────────────────────── */

// ShipmentStatus = "Label Created" | "Ready to Dispatch" | "Handed Over" | "In Transit"
//   | "Out for Delivery" | "Delivery Failed" | "Returning" | "Delivered" | "Returned" | "Exception" | "Cancelled"
// docs/warehouse/09-shipping §5
export const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, readonly ShipmentStatus[]> = {
  "Label Created": ["Ready to Dispatch"],
  "Ready to Dispatch": ["Handed Over"],
  "Handed Over": ["In Transit"],
  "In Transit": ["Out for Delivery", "Exception"],
  "Out for Delivery": ["Delivered", "Delivery Failed"],
  "Delivery Failed": ["Out for Delivery", "Returning"],
  Returning: ["Returned"],
  Delivered: [],
  Returned: [],
  Exception: ["In Transit", "Returning"],
  Cancelled: [],
};

/* ── Module 10: Inter-warehouse Transfer ─────────────────────────────── */

// TransferOrderStatus = "Draft" | "Pending Approval" | "Approved" | "Picking"
//   | "In Transit" | "Partially Received" | "Received" | "Completed" | "Cancelled"
// docs/warehouse/10-transfer §5
export const TRANSFER_TRANSITIONS: Record<TransferOrderStatus, readonly TransferOrderStatus[]> = {
  Draft: ["Pending Approval"],
  "Pending Approval": ["Approved", "Cancelled"],
  Approved: ["Picking"],
  Picking: ["In Transit"],
  "In Transit": ["Partially Received", "Received"],
  "Partially Received": ["Received"],
  Received: ["Completed"],
  Completed: [],
  Cancelled: [],
};

/* ── Module 11: Intra-warehouse Move ─────────────────────────────────── */

// MoveTaskStatus = "Suggested" | "Pending" | "Assigned" | "In Progress" | "On Hold"
//   | "Discrepancy" | "Completed" | "Cancelled" | "Rejected"
// docs/warehouse/11-moves §5
export const MOVE_TRANSITIONS: Record<MoveTaskStatus, readonly MoveTaskStatus[]> = {
  Suggested: ["Pending", "Rejected"],
  Pending: ["Assigned"],
  Assigned: ["In Progress"],
  "In Progress": ["Completed", "Discrepancy", "On Hold"],
  "On Hold": ["In Progress", "Cancelled"],
  Discrepancy: ["In Progress", "Cancelled"],
  Completed: [],
  Cancelled: [],
  Rejected: [],
};

/* ── Module 14: Order ────────────────────────────────────────────────── */

// Chép nguyên BE `order/api/OrderStatus.java#canTransitionTo` (10 trạng thái, ON_HOLD có từ BE
// commit 2e9c4df) — FE khớp BE, không dựng theo docs 17 (xem QUYẾT ĐỊNH ở ORDER_STATUSES).
// Mã wire ↔ nhãn FE: features/order/status-map.ts (PAID ↔ "Paid", IN_FULFILMENT ↔ "In Fulfilment").
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  // DRAFT → PENDING_PAYMENT / CANCELLED
  Draft: ["Pending Payment", "Cancelled"],
  // PENDING_PAYMENT → PAID / CANCELLED
  "Pending Payment": ["Paid", "Cancelled"],
  // PAID → IN_FULFILMENT / ON_HOLD / CANCELLED
  Paid: ["In Fulfilment", "On Hold", "Cancelled"],
  // IN_FULFILMENT → SHIPPED / ON_HOLD / CANCELLED
  "In Fulfilment": ["Shipped", "On Hold", "Cancelled"],
  // ON_HOLD → IN_FULFILMENT / CANCELLED
  "On Hold": ["In Fulfilment", "Cancelled"],
  // BE BR-031 (OrderStatus#canTransitionTo); docs 17 BR-03 (§6 / §4.5): từ SHIPPED hàng đã ở
  // chỗ hãng vận chuyển — không còn Cancelled, phải đi flow trả hàng.
  Shipped: ["Delivered"],
  // DELIVERED → COMPLETED / RETURNED
  Delivered: ["Completed", "Returned"],
  // Terminal (OrderStatus#isTerminal)
  Completed: [],
  Cancelled: [],
  Returned: [],
};
