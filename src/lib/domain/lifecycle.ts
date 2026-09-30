/**
 * Lifecycle transition tables — ALL modules.
 *
 * Each table is the single source of truth for "which status transitions are
 * allowed" in the frontend.  The data comes from docs §5 "Trạng thái / Vòng đời"
 * tables.  When docs change, update here + tests in one commit.
 *
 * Usage:
 *   canTransition(PO_TRANSITIONS, "DRAFT", "APPROVED") // true
 *   isTerminal(PO_TRANSITIONS, "CLOSED")               // true
 */

/* ── Generic helpers ─────────────────────────────────────────────────── */

/**
 * Next states of `from`, or `undefined` when `from` is not a key of the table.
 *
 * Statuses reaching the UI are zod-parsed at the API boundary, so this should never be
 * `undefined` in practice. The guard is defensive only: a status outside the table must
 * render as "no actions" rather than crash a page with `undefined.length`
 * (regression locked by `lifecycle.test.ts`).
 */
function nextOf<S extends string>(
  table: Record<S, readonly S[]>,
  from: S,
): readonly S[] | undefined {
  return Object.prototype.hasOwnProperty.call(table, from) ? table[from] : undefined;
}

/** Is `from → to` allowed by `table`? Unknown `from` → false. */
export function canTransition<S extends string>(
  table: Record<S, readonly S[]>,
  from: S,
  to: S,
): boolean {
  return nextOf(table, from)?.includes(to) ?? false;
}

/** No outgoing transition. Unknown status is treated as terminal (no mutating action). */
export function isTerminal<S extends string>(table: Record<S, readonly S[]>, status: S): boolean {
  return (nextOf(table, status) ?? []).length === 0;
}

/** Statuses reachable in one step from `from` (empty for terminal / unknown). */
export function allowedTransitions<S extends string>(
  table: Record<S, readonly S[]>,
  from: S,
): readonly S[] {
  return nextOf(table, from) ?? [];
}

/* ── Types from mock-data ────────────────────────────────────────────── */

import type { PoStatus } from "@/constants";
import type {
  ProductStatus,
  SkuStatus,
  ReceiptStatus,
  QcStatus,
  InvoiceStatus,
  PutawayStatus,
  PickStatus,
  PackStatus,
  ShipmentStatus,
  TransferOrderStatus,
  MoveTaskStatus,
} from "@/lib/mock-data";

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

// docs 02-purchase-order §5 — bảng "Chuyển tiếp cho phép", thu hẹp theo BE
// PurchaseOrderStatus.java (SCRUM-113/116). FE mirror BE vì BE mới là nơi thực thi;
// ánh xạ docs → BE:
//   Draft → Pending Approval / Approved   ⇒ DRAFT → APPROVED (BE gộp submit+approve)
//   Approved → Confirmed                  ⇒ APPROVED → SENT
//   Confirmed / Partially Received → Received → Closed ⇒ receiveGoods tự đóng CLOSED
//     khi hết open qty (không qua PO_TRANSITIONS — xem PO_ACTIONS "receive")
//   Partially Received → Closed (short-close) ⇒ PARTIALLY_RECEIVED → CLOSED_SHORT
// ASSUMPTION (open-question A2): BE chưa có Pending Approval / hạn mức duyệt (BR-PO-002).
export const PO_TRANSITIONS: Record<PoStatus, readonly PoStatus[]> = {
  DRAFT: ["APPROVED", "CANCELLED"],
  APPROVED: ["SENT", "CANCELLED"],
  // BR-05 (docs 02 §6): chỉ huỷ được khi CHƯA nhận hàng — SENT chưa có receipt nào.
  SENT: ["CANCELLED"],
  // BR-05 (docs 02 §6): đã nhận một phần ⇒ không còn CANCELLED, chỉ short-close.
  PARTIALLY_RECEIVED: ["CLOSED_SHORT"],
  CLOSED: [], // terminal
  CLOSED_SHORT: [], // terminal
  CANCELLED: [], // terminal
};

/* ── Module 03: Receipt ──────────────────────────────────────────────── */

// ReceiptStatus = "Draft" | "Confirmed" | "In Putaway" | "Closed" | "Cancelled"
// docs/warehouse/03-receipt §5
export const RECEIPT_TRANSITIONS: Record<ReceiptStatus, readonly ReceiptStatus[]> = {
  Draft: ["Confirmed"],
  Confirmed: ["In Putaway", "Closed"],
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
