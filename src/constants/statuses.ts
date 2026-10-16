/**
 * BE `PurchaseOrderStatus` (quyết định D4, BE PR #71): gửi duyệt → duyệt (4 mắt) → xác nhận
 * (= chốt và gửi NCC) → nhận hàng qua phiếu nhận → đóng. `SENT` cũ là `CONFIRMED`;
 * `CLOSED_SHORT` cũ là `CLOSED` + `closeKind = SHORT_CLOSE`.
 */
export const PO_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "CONFIRMED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CLOSED",
  "CANCELLED",
] as const;

export const PO_STATUS = {
  DRAFT: "DRAFT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  CONFIRMED: "CONFIRMED",
  PARTIALLY_RECEIVED: "PARTIALLY_RECEIVED",
  RECEIVED: "RECEIVED",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
} as const satisfies Record<string, PoStatus>;

/** BE `purchase_order_lines.status`. */
export const PO_LINE_STATUSES = [
  "OPEN",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CLOSED",
  "CANCELLED",
] as const;

/** BE `closeKind` của PO đã đóng. */
export const PO_CLOSE_KIND = {
  NORMAL: "NORMAL",
  SHORT_CLOSE: "SHORT_CLOSE",
  FORCE_CLOSE: "FORCE_CLOSE",
} as const;

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

/**
 * Trạng thái lấy hàng của task xuất kho — HỆ QUY CHIẾU LÀ BE, không phải docs.
 * Mỗi giá trị BE `fulfillment/internal/domain/PickStatus.java` ứng đúng 1 tên hiển thị = chính tên
 * enum BE viết Title Case (như module phiếu nhận: `DRAFT` → `Draft`), không đổi nghĩa, không mượn
 * tên trạng thái docs 07 §5.1 (`Assigned` / `In Progress` / `Completed`…). Docs chỉ để tham khảo:
 * BE đổi enum thì FE mới đổi theo.
 * `SHORT` có trong enum BE nhưng chưa code nào set.
 */
export const PICK_STATUSES = ["Pending", "Picking", "Picked", "Short", "Cancelled"] as const;

export const PICK_STATUS = {
  PENDING: "Pending",
  PICKING: "Picking",
  PICKED: "Picked",
  SHORT: "Short",
  CANCELLED: "Cancelled",
} as const satisfies Record<PickApiStatus, PickStatus>;

/** BE `fulfillment/internal/domain/PickStatus.java` — giá trị nhận qua API. */
export const PICK_API_STATUSES = ["PENDING", "PICKING", "PICKED", "SHORT", "CANCELLED"] as const;

/** Đổi 1-1 giá trị BE → tên hiển thị; khoá theo enum BE nên BE thêm giá trị là typecheck báo. */
export const PICK_STATUS_BY_API = PICK_STATUS;

/**
 * Trạng thái đóng gói — HỆ QUY CHIẾU LÀ BE `fulfillment/internal/domain/PackStatus.java`, cùng quy
 * tắc với `PICK_STATUSES` (tên enum BE viết Title Case; docs 08 §5 chỉ để tham khảo).
 * `PACKING` có trong enum BE nhưng chưa code nào set — `status-map` chưa có nhãn, thêm khi BE dùng.
 */
export const PACK_STATUSES = ["Pending", "Packing", "On Hold", "Packed", "Cancelled"] as const;

export const PACK_STATUS = {
  PENDING: "Pending",
  PACKING: "Packing",
  ON_HOLD: "On Hold",
  PACKED: "Packed",
  CANCELLED: "Cancelled",
} as const satisfies Record<PackApiStatus, PackStatus>;

/** BE `fulfillment/internal/domain/PackStatus.java` — giá trị nhận qua API. */
export const PACK_API_STATUSES = ["PENDING", "PACKING", "ON_HOLD", "PACKED", "CANCELLED"] as const;

/** Đổi 1-1 giá trị BE → tên hiển thị; khoá theo enum BE nên BE thêm giá trị là typecheck báo. */
export const PACK_STATUS_BY_API = PACK_STATUS;

/** BE `design/api/DesignArtifactRole.java` — vai trò file trong bundle thiết kế đã khoá. */
export const DESIGN_ARTIFACT_ROLES = [
  "CUSTOMER_PREVIEW",
  "TECHNICAL_SPEC",
  "PRINT_READY",
  "PRODUCTION_INSTRUCTION",
] as const;

/** Trạng thái đơn BE cho phép tạo task xuất kho (FulfillmentServiceImpl#createTask). */
export const FULFILLABLE_ORDER_API_STATUSES = ["CONFIRMED", "READY_TO_FULFILL"] as const;

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
 * Order — đúng 12 trạng thái của BE `order/api/OrderStatus.java` (develop, sau SCRUM-460/423/427),
 * ánh xạ 1-1 với mã wire (PENDING_PAYMENT ↔ "Pending Payment"…, xem features/order/status-map.ts).
 * SCRUM-460 bỏ PAID → CONFIRMED; SCRUM-423 thêm IN_PRODUCTION / READY_TO_FULFILL (release).
 *
 * QUYẾT ĐỊNH (lệch quy tắc "docs thắng" của CLAUDE.md, chủ đích cho module order): FE khớp BE,
 * KHÔNG dựng theo 20 trạng thái của docs 17 §5 — docs tách nhiều bước (Picking, Packed…) mà BE
 * gộp vào IN_FULFILMENT, hiển thị chúng là hứa trạng thái BE không bao giờ trả.
 * mock-data.ts vẫn dùng 20 trạng thái docs; route mock gộp về trạng thái BE trước khi trả.
 *
 * Đây là các trạng thái FE HIỂU — nguồn cho bộ lọc, URL và tham số gửi BE. Trạng thái BE mới mà
 * FE chưa hỗ trợ đọc về thành `ORDER_STATUS_UNKNOWN` (xem `ORDER_READ_STATUSES`), không thêm ở đây.
 */
export const ORDER_STATUSES = [
  "Draft",
  "Pending Payment",
  "Confirmed",
  "In Production",
  "Ready to Fulfill",
  "In Fulfilment",
  "On Hold",
  "Shipped",
  "Delivered",
  "Completed",
  "Cancelled",
  "Returned",
] as const;

/**
 * Trạng thái phòng thủ khi đọc: BE trả giá trị ngoài `ORDER_STATUSES` (BE thêm trạng thái mới
 * trước FE) → hiển thị "Không rõ" (lib/status-map), không có thao tác nào. Chỉ để ĐỌC — không bao
 * giờ là giá trị lọc / gửi BE.
 */
export const ORDER_STATUS_UNKNOWN = "UNKNOWN";

/** Trạng thái đơn sau khi parse response BE: trạng thái đã biết hoặc `ORDER_STATUS_UNKNOWN`. */
export const ORDER_READ_STATUSES = [...ORDER_STATUSES, ORDER_STATUS_UNKNOWN] as const;

/** Nhà cung cấp (module 01) — BE: ACTIVE/INACTIVE (SCRUM-118). */
export const SUPPLIER_STATUSES = ["Active", "Inactive", "Blacklisted"] as const;

export const SUPPLIER_STATUS = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  BLACKLISTED: "Blacklisted",
} as const satisfies Record<string, SupplierStatus>;

/**
 * Giá trị status trên wire của BE (SaveSupplierRequest/SupplierResponse). BE PR #71 thêm
 * BLACKLISTED = ngừng hợp tác có lý do không đặt lại (không nhận PO mới như INACTIVE).
 */
export const SUPPLIER_API_STATUSES = ["ACTIVE", "INACTIVE", "BLACKLISTED"] as const;

/** Kênh gửi PO cho NCC — BE `communicationChannel` (EMAIL|API, BE PR #36). */
export const SUPPLIER_CHANNELS = ["EMAIL", "API"] as const;

/**
 * Lệnh chuyển kho liên kho — BE `TransferStatus` (SCRUM-327, `inventory/internal/domain/TransferStatus.java`),
 * nguyên văn mã wire, cùng vòng đời docs 10 §5. FE hiển thị qua status-map như PO.
 */
export const TRANSFER_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PICKING",
  "IN_TRANSIT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "COMPLETED",
  "CLOSED",
  "CANCELLED",
] as const;

export const TRANSFER_STATUS = {
  DRAFT: "DRAFT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  PICKING: "PICKING",
  IN_TRANSIT: "IN_TRANSIT",
  PARTIALLY_RECEIVED: "PARTIALLY_RECEIVED",
  RECEIVED: "RECEIVED",
  COMPLETED: "COMPLETED",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
} as const satisfies Record<string, TransferStatus>;

/** BE `TransferReason` — lý do chuyển kho (CreateTransferOrderRequest.reason, tuỳ chọn). */
export const TRANSFER_REASONS = ["REBALANCING", "DEMAND", "CAMPAIGN", "OVERFLOW", "OTHER"] as const;

/**
 * Chuyến xe xuất hàng — `LoadStatus` theo BE business-design 03-state-machines §11.
 * ASSUMPTION: BE SCRUM-288 chưa có enum; FE dùng đúng tên trong thiết kế, khớp lại khi BE lên.
 */
export const LOAD_STATUSES = [
  "PLANNED",
  "VEHICLE_BOOKED",
  "LOADING",
  "DISPATCHED",
  "CANCELLED",
] as const;

export const LOAD_STATUS = {
  PLANNED: "PLANNED",
  VEHICLE_BOOKED: "VEHICLE_BOOKED",
  LOADING: "LOADING",
  DISPATCHED: "DISPATCHED",
  CANCELLED: "CANCELLED",
} as const satisfies Record<string, LoadStatus>;

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
export type PickStatus = (typeof PICK_STATUSES)[number];
export type PickApiStatus = (typeof PICK_API_STATUSES)[number];
export type PackStatus = (typeof PACK_STATUSES)[number];
export type PackApiStatus = (typeof PACK_API_STATUSES)[number];
export type DesignArtifactRole = (typeof DESIGN_ARTIFACT_ROLES)[number];
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export type SkuStatus = (typeof SKU_STATUSES)[number];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderReadStatus = (typeof ORDER_READ_STATUSES)[number];
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];
export type SupplierApiStatus = (typeof SUPPLIER_API_STATUSES)[number];
export type SupplierChannel = (typeof SUPPLIER_CHANNELS)[number];
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];
export type TransferReason = (typeof TRANSFER_REASONS)[number];
export type LoadStatus = (typeof LOAD_STATUSES)[number];
