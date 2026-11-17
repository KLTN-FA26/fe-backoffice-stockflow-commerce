/**
 * Trả hàng (RMA) & phiếu nhập hàng hoàn (docs 17 §4.10, 03 §4.2 BR-14, 15 §4.5; WF-05 BO-12..BO-16).
 * Tên trạng thái theo BE `ReturnStatus` (docs 17 không có bảng trạng thái riêng cho yêu cầu trả hàng —
 * code BE là nguồn đúng). Phiếu nhập hàng hoàn là phiếu nhận loại RETURN (BE `GoodsReceiptStatus`).
 */

/* ── Quyền (BE `OrderResources.RMAS` / `RMA_RESOLUTIONS`, baseline V20261111000000) ─────── */

/**
 * Resource `sales-rmas`: Sale + Quản trị đủ VIEW_PAGE / READ / CREATE (mở thay khách) / UPDATE (rút thay khách) /
 * APPROVE (duyệt / từ chối); Kế toán và Kho chỉ VIEW_PAGE + READ (đối chiếu hoá đơn điều chỉnh, lập phiếu nhập).
 */
export const RMA_PERMISSIONS = {
  viewPage: "sales-rmas:VIEW_PAGE",
  read: "sales-rmas:READ",
  create: "sales-rmas:CREATE",
  update: "sales-rmas:UPDATE",
  approve: "sales-rmas:APPROVE",
} as const;

/**
 * Resource `sales-rma-resolutions` (không có VIEW_PAGE / READ): UPDATE = Sale đề xuất hoàn tiền, APPROVE = Kế toán
 * duyệt / trả lại đề xuất — không phải người đề xuất (bốn mắt, BE `RETURN_SELF_APPROVAL`).
 */
export const RMA_RESOLUTION_PERMISSIONS = {
  propose: "sales-rma-resolutions:UPDATE",
  approve: "sales-rma-resolutions:APPROVE",
} as const;

/* ── Route ──────────────────────────────────────────────────────────────────────────────── */

const ORDERS_BASE = "/admin/orders";
const RECEIPTS_BASE = "/admin/receipts";

export const RETURN_ROUTES = {
  /** Segment tĩnh `returns` ưu tiên hơn `/admin/orders/[id]`. */
  list: `${ORDERS_BASE}/returns`,
  /** Trả hàng đã hoàn tiền cần hoá đơn điều chỉnh (BE `GET /returns?vatAdjustment=true`). */
  vatAdjustment: `${ORDERS_BASE}/returns?vatAdjustment=true`,
  detail: (id: string) => `${ORDERS_BASE}/returns/${encodeURIComponent(id)}`,
  receipts: {
    /** Segment tĩnh `returns` ưu tiên hơn `/admin/receipts/[id]`. */
    list: `${RECEIPTS_BASE}/returns`,
    detail: (id: string) => `${RECEIPTS_BASE}/returns/${encodeURIComponent(id)}`,
    /** Lập phiếu từ một yêu cầu trả hàng đang chờ hàng về. */
    createFor: (returnRequestId: string) =>
      `${RECEIPTS_BASE}/returns?create=1&returnRequestId=${encodeURIComponent(returnRequestId)}`,
  },
} as const;

/* ── Trạng thái yêu cầu trả hàng (BE `ReturnStatus`) ───────────────────────────────────── */

export const RETURN_API_STATUSES = [
  "REQUESTED",
  "AWAITING_RETURN",
  "RECEIVED",
  "INSPECTED",
  "SETTLEMENT_PENDING",
  "RESOLVED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type ReturnApiStatus = (typeof RETURN_API_STATUSES)[number];

/** Trạng thái lọc được (bỏ `INSPECTED` — chỉ còn trong lịch sử, BE 4D-3). */
export const RETURN_FILTER_STATUSES = RETURN_API_STATUSES.filter((s) => s !== "INSPECTED");

/** Chuỗi hiển thị (domain `rma` của status-map) — nhãn Việt ghi đè theo domain. */
export const RETURN_STATUS_BY_API = {
  REQUESTED: "Requested",
  AWAITING_RETURN: "Awaiting Return",
  RECEIVED: "Received",
  INSPECTED: "Inspected",
  SETTLEMENT_PENDING: "Settlement Pending",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
} as const satisfies Record<ReturnApiStatus, string>;

/** Còn đang xử lý: giữ đơn không hoàn tất (BE `ReturnStatus.isOpen`, BR-ORD-005). */
export const RETURN_OPEN_STATUSES = [
  "REQUESTED",
  "AWAITING_RETURN",
  "RECEIVED",
  "SETTLEMENT_PENDING",
] as const satisfies readonly ReturnApiStatus[];

/** Lý do (BE `ReturnReason`). `SHORT_DELIVERY` bị BE từ chối khi mở (không có hàng để gửi về). */
export const RETURN_REASONS = [
  "PRINT_DEFECT",
  "DESIGN_MISMATCH",
  "DAMAGED_IN_TRANSIT",
  "WRONG_ITEM",
  "SHORT_DELIVERY",
  "CHANGED_MIND",
  "OTHER",
] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

/**
 * Lý do mở được: bỏ giao thiếu (sửa kết quả giao, không phải trả hàng — BE `RETURN_REASON_NOT_ACCEPTED`) và đổi ý
 * (chính sách mặc định từ chối — BE `ReturnPolicy.changeOfMindForStockItems = false`).
 */
export const RETURN_OPENABLE_REASONS = [
  "PRINT_DEFECT",
  "DESIGN_MISMATCH",
  "DAMAGED_IN_TRANSIT",
  "WRONG_ITEM",
  "OTHER",
] as const satisfies readonly ReturnReason[];

/** Hàng in theo thiết kế của khách chỉ trả vì lỗi có tên (BR-RMA-002, docs 17 BR-08) — `OTHER` không tính. */
export const RETURN_NAMED_FAULTS = [
  "PRINT_DEFECT",
  "DESIGN_MISMATCH",
  "DAMAGED_IN_TRANSIT",
  "WRONG_ITEM",
] as const satisfies readonly ReturnReason[];

export const RETURN_CHANNELS = ["PORTAL", "BACK_OFFICE"] as const;

/* ── Phiếu nhập hàng hoàn (BE `GoodsReceiptStatus`, loại RETURN) ───────────────────────── */

export const RETURN_RECEIPT_API_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "CONFIRMED",
  "IN_PUTAWAY",
  "CLOSED",
  "CANCELLED",
] as const;
export type ReturnReceiptApiStatus = (typeof RETURN_RECEIPT_API_STATUSES)[number];

/** Chuỗi hiển thị (domain `receipt`). Phiếu hàng hoàn chỉ đi DRAFT → CLOSED / CANCELLED. */
export const RETURN_RECEIPT_STATUS_BY_API = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  CONFIRMED: "Confirmed",
  IN_PUTAWAY: "In Putaway",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
} as const satisfies Record<ReturnReceiptApiStatus, string>;

/* ── Giới hạn (BE `ReturnRequests`, `CreateReturnReceiptRequest`, `ScanReturnCartonRequest`) ─ */

export const RETURN_LIMITS = {
  descriptionMax: 2000,
  noteMax: 1000,
  reasonMax: 500,
  lateClaimReasonMax: 500,
  linesMax: 100,
  receiptNoteMax: 2000,
  lpnMax: 30,
  conditionMax: 500,
  locationCodeMax: 64,
  /** Ảnh bằng chứng: JPEG / PNG / WebP ≤ 15 MB, tối đa 10 ảnh (BE `ReturnPolicy.maxEvidence`). */
  evidenceMaxBytes: 15 * 1024 * 1024,
  evidenceMax: 10,
  evidenceTypes: ["image/jpeg", "image/png", "image/webp"],
  /** Hạn đổi / trả 7 ngày sau giao, hạn gửi hàng về 14 ngày sau duyệt (BE `ReturnPolicy.defaults`). */
  windowDays: 7,
  returnDeadlineDays: 14,
  /** Trần `size` của BE (`Pages.MAX_PAGE_SIZE`). */
  pageSizeMax: 200,
} as const;

export const RETURN_STORAGE_KEYS = {
  listConfig: "stockflow:admin:orders:returns:config",
  receiptsConfig: "stockflow:admin:receipts:returns:config",
} as const;
