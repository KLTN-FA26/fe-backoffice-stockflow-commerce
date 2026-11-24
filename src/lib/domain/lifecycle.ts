/**
 * Lifecycle transition tables — ALL modules.
 *
 * Each table is the single source of truth for "which status transitions are
 * allowed" in the frontend.  The data comes from docs §5 "Trạng thái / Vòng đời"
 * tables.  When docs change, update here + tests in one commit.
 *
 * Usage:
 *   canTransition(PRODUCT_TRANSITIONS, "Draft", "Pending Approval") // true
 *   isTerminal(PRODUCT_TRANSITIONS, "Discontinued")              // true
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

import type { ProductStatus, SkuStatus, QcStatus, MoveTaskStatus } from "@/lib/mock-data";
// OrderStatus lấy từ constants/statuses.ts (không phải mock-data) — đúng 19 trạng thái BE
// (OrderStatus.java, PR #133), dùng cho zod enum / lifecycle / filter UI; OrderReadStatus thêm
// UNKNOWN (trạng thái BE FE chưa hiểu) — chỉ đọc, không chuyển tiếp được, không là đích.
// ReceiptStatus cũng vậy — trạng thái BE GoodsReceiptStatus (docs 03 §5).
// PickStatus / PackStatus: các trạng thái BE `/fulfillment/tasks` phát ra được (SCRUM-437).
import type {
  CartonStatus,
  LoadStatus,
  OrderReadStatus,
  OrderStatus,
  PackStatus,
  PickStatus,
  ReceiptStatus,
  ShipmentApiStatus,
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

/* ── Module 03: Receipt ──────────────────────────────────────────────── */

// ReceiptStatus = "Draft" | "Pending Approval" | "Confirmed" | "In Putaway" | "Closed" | "Cancelled"
// docs/warehouse/03-receipt §5 — bảng "Chuyển tiếp" (rescope 04/11); BE GoodsReceiptStatus. Phiếu hàng hoàn có
// màn riêng (`features/return`), nên bảng này là của phiếu theo Đơn sản xuất.
export const RECEIPT_TRANSITIONS: Record<ReceiptStatus, readonly ReceiptStatus[]> = {
  // BR-05 (docs 03 §6): chỉ phiếu Draft được huỷ; đã xác nhận thì sửa bằng điều chỉnh tồn có duyệt.
  // BE đi qua Confirmed trong cùng transaction xác nhận rồi sang In Putaway (không QC ở kho, BR-07).
  Draft: ["Confirmed", "Cancelled"],
  // Mã cũ của BE — không còn bước duyệt vượt dung sai (BR-02: không nhận quá Đơn sản xuất); chỉ đọc
  "Pending Approval": [],
  Confirmed: ["In Putaway"],
  // Cất xong mọi thùng → Closed tự động (docs 03 §4.1 bước 8)
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

/* ── Module 05: Putaway — `features/putaway/lifecycle.ts` (BE PutawayStatus, docs 05 §5) ── */

/* ── Module 07: Picking ──────────────────────────────────────────────── */

// HỆ QUY CHIẾU LÀ BE: chép đúng các chuyển trạng thái BE `PickStatus` / `PickJpaEntity` (docs 07 §5.1), dùng
// chung cho mọi màn đọc pick task:
//   PENDING → PICKING (bắt đầu) → PICKED (đích DISPATCH) | STAGED (đích STAGING, mọi dòng đã về khu chờ xuất);
//   STAGED → PICKED (quản lý kho chuyển cả tác vụ sang khu xuất hàng, `dispatch-transfer`);
//   STAGED / PICKED → PICKING (lấy bổ sung — `top-up`, docs 07 §4.3 bước 7);
//   mọi trạng thái chưa huỷ → CANCELLED do đơn bị huỷ (BE OrderCancellationListener), không phải thao tác trên task.
export const PICK_TRANSITIONS: Record<PickStatus, readonly PickStatus[]> = {
  Pending: ["Picking", "Cancelled"],
  Picking: ["Picked", "Staged", "Cancelled"],
  Staged: ["Picking", "Picked", "Cancelled"],
  Picked: ["Picking", "Cancelled"],
  Cancelled: [],
};

/* ── Module 08: Packing ──────────────────────────────────────────────── */

// HỆ QUY CHIẾU LÀ BE: chép đúng `PackStatus` (docs 08 §5.1, BE V20261113000700): PENDING → IN_PROGRESS (bắt đầu
// kiểm thùng, `packing-start`) → COMPLETED (hoàn tất đủ) hoặc ở lại IN_PROGRESS (hoàn tất một phần: đã tạo
// shipment, còn thùng chờ kiểm); PENDING / IN_PROGRESS → CANCELLED khi đơn huỷ trước thùng đầu tiên được dán
// nhãn. `COMPLETED` / `CANCELLED` là trạng thái cuối. Không còn ON_HOLD (không có giữ vì kiểm tra thiết kế).
export const PACK_TRANSITIONS: Record<PackStatus, readonly PackStatus[]> = {
  Pending: ["In Progress", "Cancelled"],
  "In Progress": ["In Progress", "Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

// Thùng giao (docs 08 §5.2, BE `PackageStatus` của 4C-6): To Check → Checked (quét đúng LPN) → Labeled (in và dán nhãn
// giao hàng); To Check / Checked / Labeled → Removed (loại thùng hư hỏng; Labeled chỉ khi chưa thuộc shipment). Labeled
// còn đi tiếp vào shipment (module 09) nhưng đó không phải một trạng thái của thùng ở trạm. `Removed` là cuối.
export const CARTON_TRANSITIONS: Record<CartonStatus, readonly CartonStatus[]> = {
  "To Check": ["Checked", "Removed"],
  Checked: ["Labeled", "Removed"],
  Labeled: ["Removed"],
  Removed: [],
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

// Chép nguyên BE `order/api/OrderStatus.java#canTransitionTo` (21 trạng thái; docs 17 §5.1 — bảng chuyển
// cũng nằm ở DB `ordering.order_status_transition`, trigger chặn mọi nhảy cóc). FE khớp BE, không dựng
// theo docs 17. Mã wire ↔ nhãn FE: features/order/status-map.ts (PENDING_PAYMENT ↔ "Pending Payment"…).
// WF-05 BO-06 (C-11): chép lại từ BE develop + các cạnh mới của G1 (fix plan §6.1 X-8, §6.2 F-8, BE-40).
export const ORDER_TRANSITIONS: Record<OrderReadStatus, readonly OrderStatus[]> = {
  // 14 §5.3: chỉ đi qua hợp đồng — cạnh checkout cũ sang Pending Payment / Confirmed / On Hold đã bỏ (4B-10)
  Draft: ["Pending Contract", "Cancelled"],
  // Hợp đồng đã gửi, chờ ký (14 §5.3): ký → chờ đợt ON_SIGNING / xác nhận / treo tín dụng; huỷ hợp đồng → Draft
  "Pending Contract": ["Draft", "Pending Payment", "Confirmed", "On Hold", "Cancelled"],
  "Pending Payment": ["Confirmed", "Cancelled"],
  // Awaiting Stock: đợt giao kế tiếp thiếu thành phẩm, Đơn sản xuất đã gửi (17 §4.4 bước 15, BR-04)
  Confirmed: ["Awaiting Stock", "In Production", "Ready to Fulfill", "On Hold", "Cancelled"],
  // Nhận đủ hàng → release → Ready to Fulfill; giao trước phần có sẵn → Partially Fulfilled (17 §5.1)
  "Awaiting Stock": ["Ready to Fulfill", "Partially Fulfilled", "On Hold", "Cancelled"],
  "In Production": ["Ready to Fulfill", "Partially Fulfilled", "On Hold", "Cancelled"],
  // PACKED trực tiếp: đơn chỉ có hàng in (17 §4.2.6)
  "Ready to Fulfill": ["Picking", "Packed", "Partially Fulfilled", "On Hold", "Cancelled"],
  Picking: ["Packed", "Partially Fulfilled", "On Hold", "Cancelled"],
  // Giao một phần (G4-Q3): phần còn lại đóng gói / bàn giao / đóng bởi nhân viên → đơn theo các lô giao.
  // Partially Refunded: một lô hoàn về trong khi lô khác đã giao, phần đó được hoàn tiền (RTM-RETURNED-PARTIAL).
  // Closed: như thế nhưng không có gì phải hoàn — không hoàn đồng nào thì không phải "hoàn một phần" (WF-05 BE-45, audit r2
  // M-6; BE `Order.closeWithoutRefund`, V20261223000100)
  "Partially Fulfilled": [
    "Packed",
    "Shipped",
    "Delivery Failed",
    "Delivered",
    "Returned",
    "On Hold",
    "Partially Refunded",
    "Closed",
  ],
  // Không còn Cancelled: kiện đã đóng xong thì đi luồng trả hàng (quyết định 17/10, BR-ORD-004)
  Packed: ["Shipped", "Partially Fulfilled", "On Hold"],
  // Quay lại đúng trạng thái đã bị giữ; CONFIRMED / PENDING_PAYMENT cũng là quyết định công nợ (15 §4.3)
  "On Hold": [
    "Confirmed",
    "Pending Payment",
    "Awaiting Stock",
    "In Production",
    "Ready to Fulfill",
    "Picking",
    "Partially Fulfilled",
    "Packed",
    "Cancelled",
  ],
  // On Hold: chỉ còn trên đơn cũ (lô hoàn về giữ đơn chờ Sale, trước BE #377)
  Shipped: ["Delivered", "Delivery Failed", "Partially Fulfilled", "On Hold"],
  "Delivery Failed": ["Delivered", "Returned", "Partially Fulfilled", "On Hold"],
  // Delivery Failed: chỉ khi Quản lý kho sửa tay vì hãng báo sai, đơn chưa hoàn tất (17 BR-27)
  Delivered: ["Completed", "Return Requested", "Delivery Failed"],
  // Từ chối → về Delivered (quyết định 21/10). F-8 / BE-40: rút yêu cầu trả về đúng trạng thái gốc (Completed /
  // Refunded / Partially Refunded của một khiếu nại thêm)
  // Delivery Failed / Partially Fulfilled: khiếu nại kết thúc không hoàn gì trên đơn có lô giao thất bại / giao một phần —
  // đơn về lại đường giao (BE-46, BE `OrderStatus.canTransitionTo`)
  "Return Requested": [
    "Returned",
    "Delivered",
    "Completed",
    "Refunded",
    "Partially Refunded",
    "Delivery Failed",
    "Partially Fulfilled",
  ],
  // X-8: trả hàng kết thúc không hoàn đồng nào (Q-4) → Completed nếu đơn đã hoàn tất trước đó, ngược lại Delivered.
  // Delivery Failed / Partially Fulfilled: khiếu nại kết thúc không hoàn gì, đơn về đường giao (BE-46).
  // Closed: hãng chở mọi lô về / thất lạc và không có gì phải hoàn (WF-05 BE-45, audit r2 M-6; BE `Order.closeWithoutRefund`)
  // — không bao giờ với đơn RETURNED do khách trả hàng
  Returned: [
    "Refunded",
    "Partially Refunded",
    "Delivered",
    "Completed",
    "Delivery Failed",
    "Partially Fulfilled",
    "Closed",
  ],
  // Khiếu nại thêm sau hoàn tiền / sau hoàn tất vẫn mở được cho tới khi đơn đóng hẳn (BE `canTransitionTo`).
  // Returned: một lần ghi hoàn tiền bị huỷ — đơn chờ hoàn lại (TT-4)
  Refunded: ["Closed", "Return Requested", "Returned"],
  // Partially Fulfilled: lần hoàn bị huỷ là của lô hoàn về, phần còn lại đã giao (RTM-RETURNED-PARTIAL)
  "Partially Refunded": ["Closed", "Return Requested", "Returned", "Partially Fulfilled"],
  Completed: ["Closed", "Return Requested"],
  // Terminal (OrderStatus#isTerminal)
  Cancelled: [],
  Closed: [],
  // Trạng thái BE chưa biết: không suy đoán chuyển tiếp
  UNKNOWN: [],
};
