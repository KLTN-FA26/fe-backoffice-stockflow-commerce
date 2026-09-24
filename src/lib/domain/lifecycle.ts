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

/**
 * Kiểm tra transition `from` → `to` có được phép theo bảng `table` hay không.
 *
 * Guard `table[from] ?? undefined` là bắt buộc vì FE có 2 nguồn status song song:
 * - BE contract `PurchaseOrderStatus.java` (SCREAMING_SNAKE: `DRAFT`, `SENT`, `PARTIALLY_RECEIVED`)
 *   Đây là canonical type `PoStatus` (từ `src/constants/statuses.ts`).
 * - Mock seed `src/lib/mock-data.ts` vẫn dùng Title Case legacy (`Draft`, `Confirmed`,
 *   `Partially Received`, `Pending Approval`) để giữ nguyên docs cũ.
 *
 * Khi `from` là Title Case mà `table` chỉ có key SCREAMING_SNAKE thì `table[from]`
 * là `undefined`. Không guard sẽ crash ở caller `isTerminal` (`undefined.length`) hoặc
 * trả về kết quả sai. Vì lỗi này đã gây crash thực tế ở `/admin/purchase-orders/[id]`
 * (stack `isTerminal → isPoTerminal → getLifecycleSteps → PoLifecycleTimeline`),
 * helper phải chịu được `undefined` và trả về `false` (không cho chuyển).
 */
export function canTransition<S extends string>(
  table: Record<S, readonly S[]>,
  from: S,
  to: S,
): boolean {
  return !!(table[from] as unknown as readonly string[] | undefined)?.includes(to);
}

/**
 * Trạng thái có phải terminal (không còn transition nào) hay không.
 *
 * - `table[status] === undefined` → coi như terminal và return `true` để không crash.
 *   Trường hợp này xảy ra khi `status` là Title Case legacy chưa được normalize
 *   (ví dụ `Draft`, `Confirmed`). Caller đúng ra phải normalize trước qua
 *   `normalizePoStatus()` (trong `features/purchase-order/lifecycle.ts`) hoặc
 *   `normalizeApiStatus()` (trong `features/purchase-order/api.ts`), nhưng helper
 *   vẫn phải tự bảo vệ để một record lẻ không làm sập cả trang detail.
 * - `table[status].length === 0` → terminal thật (BE: `CLOSED`, `CLOSED_SHORT`, `CANCELLED`).
 */
export function isTerminal<S extends string>(table: Record<S, readonly S[]>, status: S): boolean {
  const next = table[status] as unknown as readonly unknown[] | undefined;
  if (!next) return true;
  return next.length === 0;
}

/**
 * Lấy danh sách trạng thái kề tiếp được phép từ `from`.
 *
 * Guard `?? []` để caller như `nextPoStatuses()` / `getLifecycleSteps()` luôn nhận
 * về mảng (có thể rỗng) thay vì `undefined`, tránh phải check null ở từng component.
 * Nếu `from` là Title Case chưa normalize, kết quả là `[]` — caller sẽ render timeline
 * ở trạng thái rỗng an toàn thay vì crash. Normalize đúng vẫn là trách nhiệm của
 * `features/purchase-order/lifecycle.ts` và `api.ts`.
 */
export function allowedTransitions<S extends string>(
  table: Record<S, readonly S[]>,
  from: S,
): readonly S[] {
  return (table[from] as readonly S[] | undefined) ?? ([] as unknown as readonly S[]);
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

// BE: PurchaseOrderStatus.java — simplified 7-state of docs 02 §5.
// Full docs ten-state is wider; BE deliberately narrows to this scope
// (SCRUM-113/116). FE now mirrors BE so roles/permissions gate correctly.
export const PO_TRANSITIONS: Record<PoStatus, readonly PoStatus[]> = {
  DRAFT: ["APPROVED", "CANCELLED"],
  APPROVED: ["SENT", "CANCELLED"],
  SENT: ["CANCELLED"],
  PARTIALLY_RECEIVED: ["CLOSED_SHORT"],
  CLOSED: [],
  CLOSED_SHORT: [],
  CANCELLED: [],
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
