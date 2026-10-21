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

/** BE `PurchaseOrder.Type`: chỉ PO thường (STANDARD) sửa nháp được (`PurchaseOrder#reviseDraft`). */
export const PO_TYPE = {
  STANDARD: "STANDARD",
  SUBCONTRACT: "SUBCONTRACT",
} as const;

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
 * `PACKING` = packer đã nhận đơn tại bàn đóng gói (BE PR #136: `POST /tasks/{id}/packing-start`; sau
 * khi kiểm tra lại thiết kế khớp, phiên cũng trở lại `PACKING` chứ không phải `PACKED`).
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

/** BE `fulfillment/internal/domain/PackageStatus.java` (PR #136) — kiện ở trạm đóng gói. */
export const PACKAGE_API_STATUSES = ["OPEN", "SEALED", "VOIDED"] as const;

/** BE `PackageType.java` (PR #136) — loại kiện; mặc định CARTON khi không gửi. */
export const PACKAGE_TYPES = ["CARTON", "BAG", "PALLET", "CRATE", "OTHER"] as const;

/** BE `ShipmentStatus.java` (PR #136, kltn-docs 09 §5) — lô giao do bước đóng gói tạo ra. */
export const PACK_SHIPMENT_API_STATUSES = [
  "READY_TO_DISPATCH",
  "HANDED_OVER",
  "DELIVERED",
  "DELIVERY_FAILED",
  "RETURNED",
  "CANCELLED",
] as const;

/** BE `DeliveryMode.java` — hiện mọi lô là PARCEL (BE: chờ G3-4). */
export const DELIVERY_MODES = ["PARCEL", "FULL_TRUCKLOAD"] as const;

/** Trạng thái kiện / lô giao → chuỗi status của `StatusDot` (nhãn + màu ở `lib/status-map.ts`). */
export const PACKAGE_STATUS_DISPLAY = {
  OPEN: "Package Open",
  SEALED: "Sealed",
  VOIDED: "Voided",
  UNKNOWN: "UNKNOWN",
} as const;

export const PACK_SHIPMENT_STATUS_DISPLAY = {
  READY_TO_DISPATCH: "Ready to Dispatch",
  HANDED_OVER: "Handed Over",
  DELIVERED: "Delivered",
  DELIVERY_FAILED: "Delivery Failed",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
  UNKNOWN: "UNKNOWN",
} as const;

/** BE `design/api/DesignArtifactRole.java` — vai trò file trong bundle thiết kế đã khoá. */
export const DESIGN_ARTIFACT_ROLES = [
  "CUSTOMER_PREVIEW",
  "TECHNICAL_SPEC",
  "PRINT_READY",
  "PRODUCTION_INSTRUCTION",
] as const;

/**
 * Trạng thái đơn BE cho phép tạo task xuất kho: chỉ READY_TO_FULFILL (đã release, đã chọn kho, hàng
 * in đã sản xuất xong) — đơn CONFIRMED phải release trước (BE PR #133, FulfillmentServiceImpl#createTask).
 */
export const FULFILLABLE_ORDER_API_STATUSES = ["READY_TO_FULFILL"] as const;

export const PRODUCT_STATUSES = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Active",
  "Published",
  "Inactive",
  "Discontinued",
  // Trạng thái BE chưa biết (BE mở rộng danh sách) — hiển thị "Không rõ", không chặn cả trang.
  "UNKNOWN",
] as const;

export const PRODUCT_STATUS = {
  ACTIVE: "Active",
  APPROVED: "Approved",
  DISCONTINUED: "Discontinued",
  DRAFT: "Draft",
  INACTIVE: "Inactive",
  PENDING_APPROVAL: "Pending Approval",
  PUBLISHED: "Published",
  UNKNOWN: "UNKNOWN",
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
 * Order — 19 trạng thái của BE `order/api/OrderStatus.java` (BE PR #133, SCRUM-239/246/247),
 * ánh xạ 1-1 với mã wire (PENDING_PAYMENT ↔ "Pending Payment"…, xem features/order/status-map.ts).
 * `IN_FULFILMENT` đã bị BE bỏ (tách PICKING / PACKED), `PAID` cũ là CONFIRMED.
 *
 * "UNKNOWN" không phải trạng thái BE: mã BE thêm sau này parse về đây (`.catch`) để một giá trị lạ
 * không làm hỏng cả danh sách đơn. Không có chuyển tiếp / thao tác nào từ UNKNOWN và không có ở bộ lọc.
 */
export const ORDER_STATUSES = [
  "Draft",
  "Pending Payment",
  "Confirmed",
  "In Production",
  "Ready to Fulfill",
  "Picking",
  "Partially Fulfilled",
  "Packed",
  "On Hold",
  "Shipped",
  "Delivery Failed",
  "Delivered",
  "Return Requested",
  "Returned",
  "Refunded",
  "Partially Refunded",
  "Completed",
  "Cancelled",
  "Closed",
  "UNKNOWN",
] as const;

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
 * Chuyến xe xuất hàng — BE `LoadStatus` (PR #137, SCRUM-288). Chuyến gửi kiện (PARCEL) bắt đầu ở
 * LOADING khi tài xế hãng tới; PLANNED / VEHICLE_BOOKED chỉ có ở chuyến nguyên xe (FTL, SCRUM-287).
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

/** BE `DispatchController` / `DeliveryOutcomeRequest.outcome` — kết quả hãng báo lại (docs 09 §4.3). */
export const DELIVERY_OUTCOMES = ["DELIVERED", "DELIVERY_FAILED", "RETURNED"] as const;

/** BE `CarrierResponse.status` — hãng ngừng dùng thì không nhận chuyến mới. */
export const CARRIER_STATUSES = ["ACTIVE", "INACTIVE"] as const;

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
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];
export type SupplierApiStatus = (typeof SUPPLIER_API_STATUSES)[number];
export type SupplierChannel = (typeof SUPPLIER_CHANNELS)[number];

/* ── Bán hàng B2B & sản xuất (BE local integration d215f6e, chưa merge develop) ─────────── */

/**
 * Khách hàng — BE `CustomerStatus`. Nhãn theo vòng đời docs 18 §5 (handoff SCRUM-429):
 * PENDING_ACTIVATION = Pending Activation, BLOCKED = Suspended, INACTIVE = Closed.
 */
export const CUSTOMER_API_STATUSES = [
  "PENDING_ACTIVATION",
  "ACTIVE",
  "BLOCKED",
  "INACTIVE",
] as const;
export type CustomerApiStatus = (typeof CUSTOMER_API_STATUSES)[number];
export const CUSTOMER_STATUS_BY_API = {
  PENDING_ACTIVATION: "Pending Activation",
  ACTIVE: "Active",
  BLOCKED: "Suspended",
  INACTIVE: "Closed",
} as const satisfies Record<CustomerApiStatus, string>;

/** Điều khoản thanh toán — BE `CommercialTerm` / `PaymentTerm`. */
export const PAYMENT_TERMS = ["PREPAID", "DEPOSIT", "CREDIT"] as const;
export type PaymentTerm = (typeof PAYMENT_TERMS)[number];
export const PAYMENT_TERM_LABELS = {
  PREPAID: "Trả trước",
  DEPOSIT: "Đặt cọc",
  CREDIT: "Công nợ",
} as const satisfies Record<PaymentTerm, string>;
/** Quyết định B1 (2026-10-13): Sales chỉ được chọn hai điều khoản này khi tạo khách. */
export const SALES_ONBOARDING_PAYMENT_TERMS = [
  "PREPAID",
  "DEPOSIT",
] as const satisfies readonly PaymentTerm[];

/** Báo giá — BE `QuoteStatus` (SCRUM-448). EXPIRED/CANCELLED/CONVERTED là trạng thái cuối. */
export const QUOTE_API_STATUSES = [
  "DRAFT",
  "SENT",
  "CHANGES_REQUESTED",
  "ACCEPTED",
  "EXPIRED",
  "CANCELLED",
  "CONVERTED",
] as const;
export type QuoteApiStatus = (typeof QUOTE_API_STATUSES)[number];
export const QUOTE_STATUS_BY_API = {
  DRAFT: "Draft",
  SENT: "Sent",
  CHANGES_REQUESTED: "Changes Requested",
  ACCEPTED: "Accepted",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  CONVERTED: "Converted",
} as const satisfies Record<QuoteApiStatus, string>;
/** Trạng thái khách thấy trên portal — BE `QuoteStatus.seenByCustomer`. */
export const QUOTE_PORTAL_STATUSES = [
  "SENT",
  "CHANGES_REQUESTED",
  "ACCEPTED",
  "EXPIRED",
  "CONVERTED",
] as const satisfies readonly QuoteApiStatus[];

/** Yêu cầu mẫu — BE `SampleStatus` (SCRUM-403). */
export const SAMPLE_API_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "IN_PRODUCTION",
  "READY",
  "SENT_TO_CUSTOMER",
  "CHANGES_REQUESTED",
  "APPROVED",
  "CANCELLED",
] as const;
export type SampleApiStatus = (typeof SAMPLE_API_STATUSES)[number];
export const SAMPLE_STATUS_BY_API = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  IN_PRODUCTION: "In Production",
  READY: "Ready",
  SENT_TO_CUSTOMER: "Sent to Customer",
  CHANGES_REQUESTED: "Changes Requested",
  APPROVED: "Approved",
  CANCELLED: "Cancelled",
} as const satisfies Record<SampleApiStatus, string>;

/** Lệnh sản xuất — BE `ProductionOrder.Status` (SCRUM-405..420). */
export const PRODUCTION_API_STATUSES = [
  "PENDING_PREPRESS",
  "READY",
  "MATERIAL_ISSUED",
  "PRINTING",
  "SUBCONTRACTED",
  "QC",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;
export type ProductionApiStatus = (typeof PRODUCTION_API_STATUSES)[number];
export const PRODUCTION_STATUS_BY_API = {
  PENDING_PREPRESS: "Pending Prepress",
  READY: "Ready",
  MATERIAL_ISSUED: "Material Issued",
  PRINTING: "Printing",
  SUBCONTRACTED: "Subcontracted",
  QC: "QC",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const satisfies Record<ProductionApiStatus, string>;
export const PRODUCTION_ORDER_TYPES = ["SAMPLE", "ORDER"] as const;
export type ProductionOrderType = (typeof PRODUCTION_ORDER_TYPES)[number];
export const PRODUCTION_ORDER_MODES = ["IN_HOUSE", "SUBCONTRACTED"] as const;
export type ProductionOrderMode = (typeof PRODUCTION_ORDER_MODES)[number];

/** Nhóm trạng thái đơn khách đọc — BE `CustomerOrderCardResponse.statusGroup` (develop). */
export const ORDER_STATUS_GROUPS = [
  "AWAITING_PAYMENT",
  "UNDER_REVIEW",
  "CONFIRMED",
  "IN_PRODUCTION",
  "PREPARING",
  "SHIPPING",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;
export type OrderStatusGroup = (typeof ORDER_STATUS_GROUPS)[number];
/** Nhóm → chuỗi status-map (nhãn Việt + tone dùng chung). */
export const ORDER_STATUS_GROUP_DISPLAY = {
  AWAITING_PAYMENT: "Pending Payment",
  UNDER_REVIEW: "Under Review",
  CONFIRMED: "Confirmed",
  IN_PRODUCTION: "In Production",
  PREPARING: "Preparing",
  SHIPPING: "Shipping",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
} as const satisfies Record<OrderStatusGroup, string>;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];
export type TransferReason = (typeof TRANSFER_REASONS)[number];
export type LoadStatus = (typeof LOAD_STATUSES)[number];
export type ShipmentApiStatus = (typeof PACK_SHIPMENT_API_STATUSES)[number];
export type DeliveryOutcome = (typeof DELIVERY_OUTCOMES)[number];

// Backend StockAdjustmentStatus (SCRUM-424); preserve wire values.
export const STOCK_ADJUSTMENT_STATUSES = [
  "PENDING_APPROVAL",
  "POSTED",
  "REJECTED",
  "WITHDRAWN",
] as const;

export const STOCK_ADJUSTMENT_STATUS = {
  PENDING_APPROVAL: "PENDING_APPROVAL",
  POSTED: "POSTED",
  REJECTED: "REJECTED",
  WITHDRAWN: "WITHDRAWN",
} as const satisfies Record<string, StockAdjustmentStatus>;

export type StockAdjustmentStatus = (typeof STOCK_ADJUSTMENT_STATUSES)[number];
