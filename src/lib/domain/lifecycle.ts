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
  MoveTaskStatus,
} from "@/lib/mock-data";
// OrderStatus lấy từ constants/statuses.ts (không phải mock-data) — đúng 10 trạng thái BE
// (OrderStatus.java), dùng cho zod enum / lifecycle / filter UI.
// ReceiptStatus cũng vậy — 6 trạng thái docs 03 §5.1 (mock-data chỉ có 5, thiếu "In QC").
// PickStatus / PackStatus: các trạng thái BE `/fulfillment/tasks` phát ra được (SCRUM-437).
import type {
  LoadStatus,
  OrderStatus,
  PackStatus,
  PickStatus,
  ReceiptStatus,
  ShipmentApiStatus,
  TransferStatus,
} from "@/constants/statuses";

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

// HỆ QUY CHIẾU LÀ BE: chép đúng các chuyển trạng thái BE `PickJpaEntity` đang cho phép
// (start / complete / cancel), dùng chung cho mọi màn đọc pick task. Docs 07 §5.1 chỉ để tham khảo
// — BE thêm/bỏ chuyển tiếp thì FE mới đổi theo, FE không tự thêm trạng thái docs mà BE chưa có.
// "→ Cancelled" do đơn bị huỷ (BE OrderCancellationListener), không phải thao tác trên task.
// `SHORT` có trong enum BE nhưng BE chưa có luồng nào đưa vào hay ra.
export const PICK_TRANSITIONS: Record<PickStatus, readonly PickStatus[]> = {
  Pending: ["Picking", "Cancelled"],
  Picking: ["Picked", "Cancelled"],
  Short: [],
  Picked: [],
  Cancelled: [],
};

/* ── Module 08: Packing ──────────────────────────────────────────────── */

// HỆ QUY CHIẾU LÀ BE: chép đúng phiên đóng gói BE `PackingSession` (PR #136, 03-state-machines):
// PENDING → PACKING (packer nhận đơn, `packing-start`) → PACKED (không còn gì chờ giao), PACKING ⇄
// ON_HOLD (thiết kế dòng in lệch checksum, BR-DSG-003; QC / quản lý kho kiểm tra lại thì phiên về
// PACKING — docs 08 §5 "Verification Failed → In Progress" — chứ KHÔNG ra PACKED), → CANCELLED khi
// đơn huỷ. Giao một phần giữ phiên ở PACKING. `PACKED` / `CANCELLED` là trạng thái cuối.
export const PACK_TRANSITIONS: Record<PackStatus, readonly PackStatus[]> = {
  Pending: ["Packing", "Cancelled"],
  Packing: ["Packed", "On Hold", "Cancelled"],
  "On Hold": ["Packing", "Cancelled"],
  Packed: [],
  Cancelled: [],
};

/* ── Module 09: Shipping — chuyến xe (load) ──────────────────────────── */

// BE `LoadStatus` (PR #137): chuyến gửi kiện (PARCEL) bắt đầu ở LOADING khi tài xế hãng tới →
// DISPATCHED khi hai bên ký biên bản. PLANNED → VEHICLE_BOOKED → LOADING là đường của chuyến nguyên
// xe (FTL, SCRUM-287/392); huỷ đặt xe (`booking-cancellation`, BE PR #162) đưa VEHICLE_BOOKED về
// PLANNED. Huỷ chuyến được ở mọi trạng thái còn mở (kiện về khu chờ xuất) — chuyến của kế hoạch xếp xe
// thì huỷ qua kế hoạch (409 LOAD_MANAGED_BY_PLAN).
export const LOAD_TRANSITIONS: Record<LoadStatus, readonly LoadStatus[]> = {
  PLANNED: ["VEHICLE_BOOKED", "CANCELLED"],
  VEHICLE_BOOKED: ["PLANNED", "LOADING", "CANCELLED"],
  LOADING: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: [],
  CANCELLED: [],
};

/**
 * Lô giao (BE `ShipmentStatus`, docs 09 §5): READY_TO_DISPATCH → HANDED_OVER (ký biên bản) hoặc
 * CANCELLED; kết quả hãng báo: HANDED_OVER → DELIVERED / DELIVERY_FAILED; DELIVERY_FAILED → DELIVERED
 * (giao lại) / RETURNED. DELIVERED, RETURNED, CANCELLED là cuối.
 */
export const SHIPMENT_TRANSITIONS: Record<ShipmentApiStatus, readonly ShipmentApiStatus[]> = {
  READY_TO_DISPATCH: ["HANDED_OVER", "CANCELLED"],
  HANDED_OVER: ["DELIVERED", "DELIVERY_FAILED"],
  DELIVERY_FAILED: ["DELIVERED", "RETURNED"],
  DELIVERED: [],
  RETURNED: [],
  CANCELLED: [],
};

/* ── Module 10: Inter-warehouse Transfer ─────────────────────────────── */

// docs 10 §5 = BE `TransferStatus.canTransitionTo` (SCRUM-327). DRAFT → APPROVED khi tổng SL ≤ ngưỡng
// duyệt; PENDING_APPROVAL → DRAFT khi bị từ chối; PICKING → APPROVED khi dừng lấy hàng.
// BR-04 (docs 10 §6): chỉ huỷ trước khi rời kho nguồn — sau IN_TRANSIT chỉ còn đóng (CLOSED).
export const TRANSFER_TRANSITIONS: Record<TransferStatus, readonly TransferStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "APPROVED", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "DRAFT"],
  APPROVED: ["PICKING", "CANCELLED"],
  PICKING: ["IN_TRANSIT", "APPROVED"],
  IN_TRANSIT: ["PARTIALLY_RECEIVED", "RECEIVED"],
  PARTIALLY_RECEIVED: ["RECEIVED", "CLOSED"],
  RECEIVED: ["COMPLETED"],
  COMPLETED: [],
  CLOSED: [],
  CANCELLED: [],
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

// Chép nguyên BE `order/api/OrderStatus.java#canTransitionTo` (19 trạng thái, BE PR #133 — bảng chuyển
// cũng nằm ở DB `ordering.order_status_transition`, trigger chặn mọi nhảy cóc). FE khớp BE, không dựng
// theo docs 17. Mã wire ↔ nhãn FE: features/order/status-map.ts (PENDING_PAYMENT ↔ "Pending Payment"…).
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  Draft: ["Pending Payment", "Confirmed", "On Hold", "Cancelled"],
  "Pending Payment": ["Confirmed", "Cancelled"],
  Confirmed: ["In Production", "Ready to Fulfill", "On Hold", "Cancelled"],
  "In Production": ["Ready to Fulfill", "On Hold", "Cancelled"],
  // PACKED trực tiếp: đơn chỉ có hàng in (17 §4.2.6)
  "Ready to Fulfill": ["Picking", "Packed", "On Hold", "Cancelled"],
  Picking: ["Packed", "Partially Fulfilled", "On Hold", "Cancelled"],
  // Giao một phần (G4-Q3): phần còn lại đóng gói / bàn giao / đóng bởi nhân viên → đơn theo các lô giao
  "Partially Fulfilled": [
    "Packed",
    "Shipped",
    "Delivery Failed",
    "Delivered",
    "Returned",
    "On Hold",
  ],
  // Không còn Cancelled: kiện đã đóng xong thì đi luồng trả hàng (quyết định 17/10, BR-ORD-004)
  Packed: ["Shipped", "Partially Fulfilled", "On Hold"],
  // Quay lại đúng trạng thái đã bị giữ; CONFIRMED / PENDING_PAYMENT cũng là quyết định công nợ (15 §4.3)
  "On Hold": [
    "Confirmed",
    "Pending Payment",
    "In Production",
    "Ready to Fulfill",
    "Picking",
    "Partially Fulfilled",
    "Packed",
    "Cancelled",
  ],
  Shipped: ["Delivered", "Delivery Failed", "Partially Fulfilled"],
  "Delivery Failed": ["Delivered", "Returned", "Partially Fulfilled"],
  Delivered: ["Completed", "Return Requested"],
  // Yêu cầu trả bị từ chối → về Delivered (quyết định 21/10)
  "Return Requested": ["Returned", "Delivered"],
  Returned: ["Refunded", "Partially Refunded"],
  Refunded: ["Closed"],
  "Partially Refunded": ["Closed"],
  Completed: ["Closed"],
  // Terminal (OrderStatus#isTerminal)
  Cancelled: [],
  Closed: [],
  // Trạng thái BE chưa biết: không suy đoán chuyển tiếp
  UNKNOWN: [],
};
