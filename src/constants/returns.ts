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

/**
 * Resource `sales-rma-custody` (audit r2 returns M4; BE V20261223000330): CREATE ghi biên nhận giữ hộ trên yêu cầu trả hàng
 * — và chỉ thế. Nhân viên / Quản lý kho (người nhận hàng ở cửa kho) và Sale; khách không có. Trước đây cần
 * `sales-rmas:CREATE`, mọi vai kho bị 403.
 */
export const RMA_CUSTODY_PERMISSIONS = {
  create: "sales-rma-custody:CREATE",
  /**
   * Audit r3 RAD-3 (BE V20261224000310): READ = danh sách hàng giữ hộ trên biên nhận (`GET /returns/custody-notes`) — Nhân
   * viên / Quản lý kho, Sale, Quản trị; UPDATE = ghi hàng đã rời kho đúng lựa chọn của khách — Quản lý kho, Quản trị.
   */
  read: "sales-rma-custody:READ",
  update: "sales-rma-custody:UPDATE",
} as const;

/**
 * Lựa chọn của khách cho hàng giữ hộ sau một yêu cầu không hoàn tiền (BE `ReturnCustodyChoice`, WF-05 Q-4): gửi trả (khách
 * chịu phí) hoặc khách đồng ý để công ty huỷ hộ (có biên bản — ghi chú bắt buộc). Sale ghi, Quản lý kho thực hiện.
 */
export const RETURN_CUSTODY_CHOICES = ["SEND_BACK", "DESTROY_ON_BEHALF"] as const;
export type ReturnCustodyChoice = (typeof RETURN_CUSTODY_CHOICES)[number];
export type ReturnReadCustodyChoice = ReturnCustodyChoice | typeof RETURN_UNKNOWN;

/**
 * Lựa chọn của khách cho hàng trên MỘT biên nhận giữ hộ (audit r3 RAD-3; BE `ReturnCustodyNoteChoice`, Q-11 hỏi thêm):
 * gửi trả (khách chịu phí), huỷ hộ (biên bản khách đồng ý — bắt buộc), hoặc hàng được nhận trên một yêu cầu trả hàng bổ
 * sung của cùng khách (`takenByReturnId`). Sale ghi; Quản lý kho ghi hàng đã rời kho.
 */
export const RETURN_CUSTODY_NOTE_CHOICES = [
  "SEND_BACK",
  "DESTROY_ON_BEHALF",
  "TAKEN_BY_RETURN",
] as const;
export type ReturnCustodyNoteChoice = (typeof RETURN_CUSTODY_NOTE_CHOICES)[number];
export type ReturnReadCustodyNoteChoice = ReturnCustodyNoteChoice | typeof RETURN_UNKNOWN;

/**
 * Yêu cầu bổ sung còn nhận được hàng giữ hộ — chỉ những yêu cầu này được chọn làm nơi "nhận trên yêu cầu bổ sung"
 * (confirmation audit CF-5; BE `ReturnCustodyNotes`): chưa bị từ chối / rút / hết hạn và chưa RESOLVED / INSPECTED.
 */
export const RETURN_CUSTODY_TAKER_STATUSES = [
  "REQUESTED",
  "AWAITING_RETURN",
  "RECEIVED",
  "SETTLEMENT_PENDING",
] as const;

/** Biên nhận giữ hộ: danh sách hàng đang giữ (TH-6), ghi lựa chọn, ghi đã rời kho (BE `ReturnRequestController`, RAD-3). */
export const RETURN_CUSTODY_NOTE_API = {
  list: "/returns/custody-notes",
  choice: (returnId: string, evidenceId: string) =>
    `/returns/${encodeURIComponent(returnId)}/custody/${encodeURIComponent(evidenceId)}/choice`,
  end: (returnId: string, evidenceId: string) =>
    `/returns/${encodeURIComponent(returnId)}/custody/${encodeURIComponent(evidenceId)}/end`,
} as const;

/**
 * Thùng giữ hộ khách (BE `CustomerCustodyResponse.ownership`): đang giữ / đã gửi trả / đã huỷ hộ.
 */
export const CUSTOMER_CUSTODY_OWNERSHIPS = [
  "CUSTOMER_HELD",
  "CUSTOMER_SENT_BACK",
  "CUSTOMER_DESTROYED",
] as const;
export type CustomerCustodyOwnership = (typeof CUSTOMER_CUSTODY_OWNERSHIPS)[number];

/** Danh sách / kết thúc giữ hộ (BE `StockPackageController`, `inventory-stock-packages` READ / UPDATE). */
export const CUSTOMER_CUSTODY_API = {
  list: "/inventory/stock-packages/customer-custody",
  end: (lpn: string) => `/inventory/stock-packages/${encodeURIComponent(lpn)}/customer-custody/end`,
} as const;

/**
 * Resource `procurement-return-receipt-approvals` (WF-05 Q-18, BE PR-0 `GoodsReceiptResources.RETURN_RECEIPT_APPROVALS`):
 * Quản lý kho xác nhận phiếu nhập hàng hoàn có thùng về đã mở hoặc hàng lẻ (`RETURN_RECEIPT_MANAGER_CONFIRMATION_REQUIRED`),
 * và không phải người đã quét / ghi hàng trên phiếu (`RETURN_RECEIPT_SELF_CONFIRMATION`).
 */
export const RETURN_RECEIPT_APPROVAL_PERMISSIONS = {
  approve: "procurement-return-receipt-approvals:APPROVE",
} as const;

/**
 * Ảnh trên yêu cầu trả hàng theo bước (BE G4 `ReturnEvidence.Stage`): CLAIM = ảnh khiếu nại của khách; CUSTODY = biên nhận
 * giữ hộ (WF-05 Q-11) — hàng về mà phiếu nhập không nhận. Mỗi bước tối đa `RETURN_LIMITS.evidenceMax` ảnh.
 */
export const RETURN_EVIDENCE_STAGES = { claim: "CLAIM", custody: "CUSTODY" } as const;

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
      `${RECEIPTS_BASE}/returns?create=true&returnRequestId=${encodeURIComponent(returnRequestId)}`,
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

/**
 * Giá trị BE thêm sau mà FE chưa biết (trạng thái, lý do, nguồn…) đọc về thành `UNKNOWN` (WF-05 BO-11): hiển thị
 * "Không rõ", không mở thao tác nào. KHÔNG bao giờ gửi lên BE.
 */
export const RETURN_UNKNOWN = "UNKNOWN" as const;
export type ReturnReadStatus = ReturnApiStatus | typeof RETURN_UNKNOWN;

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
  // status-map: "UNKNOWN" → "Không rõ"
  UNKNOWN: "UNKNOWN",
} as const satisfies Record<ReturnReadStatus, string>;

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
export type ReturnReadReason = ReturnReason | typeof RETURN_UNKNOWN;

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
export type ReturnChannel = (typeof RETURN_CHANNELS)[number];
export type ReturnReadChannel = ReturnChannel | typeof RETURN_UNKNOWN;

/**
 * Kết quả của một yêu cầu đã xử lý xong (BE `ReturnRequestResponse.outcome`, WF-05 F-20): REFUNDED = có hoàn tiền;
 * REFUSED = Sale đề xuất 0 đồng có lý do, Kế toán duyệt (Q-4); NOTHING_TO_REFUND = không đơn vị nào đã duyệt về dùng được
 * (TH-4). Một yêu cầu 0 đồng không bao giờ đọc là "Đã hoàn tiền".
 */
export const RETURN_OUTCOMES = ["REFUNDED", "REFUSED", "NOTHING_TO_REFUND"] as const;
export type ReturnOutcome = (typeof RETURN_OUTCOMES)[number];
export type ReturnReadOutcome = ReturnOutcome | typeof RETURN_UNKNOWN;

/**
 * Lý do từ chối hoàn (WF-05 Q-4, BE `Refund.refusalReason`): danh sách cố định — khách đọc nhãn tiếng Việt trên cổng
 * (văn bản trả lời khiếu nại, Luật Thương mại Điều 318). Bắt buộc khi mọi dòng đề xuất = 0 mà vẫn còn đơn vị hoàn được
 * (`RETURN_REFUSAL_REASON_REQUIRED`).
 */
export const RETURN_REFUSAL_REASONS = [
  "CUSTOMER_DAMAGE",
  "NOT_DEFECTIVE",
  "OUT_OF_POLICY",
  "OTHER",
] as const;
export type ReturnRefusalReason = (typeof RETURN_REFUSAL_REASONS)[number];
export type ReturnReadRefusalReason = ReturnRefusalReason | typeof RETURN_UNKNOWN;

/**
 * Trạng thái của yêu cầu mà kho lập được phiếu nhập hàng hoàn khi BE chưa gửi `receiptOpenable` (dự phòng, BE cũ chỉ nhận
 * AWAITING_RETURN). WF-05 Q-11: BE mới tự tính `receiptOpenable` (cả hàng về muộn sau "Đã nhận đủ" / hết hạn / rút sau
 * duyệt) — FE đọc cờ đó, không tự suy.
 */
export const RETURN_RECEIPT_FALLBACK_STATUSES = [
  "AWAITING_RETURN",
] as const satisfies readonly ReturnApiStatus[];
/**
 * Trạng thái liệt kê làm nguồn khi lập phiếu (WF-05 Q-11, BE-13): mọi trạng thái BE có thể cho mở phiếu; dòng nào BE nói
 * `receiptOpenable = false` thì bỏ, dòng thiếu cờ (BE cũ) chỉ giữ trạng thái dự phòng.
 */
export const RETURN_RECEIPT_SOURCE_STATUSES = [
  "AWAITING_RETURN",
  "RECEIVED",
  "SETTLEMENT_PENDING",
  "EXPIRED",
  "CANCELLED",
] as const satisfies readonly ReturnApiStatus[];

/**
 * Trạng thái hiển thị của đơn mà Sale mở được yêu cầu trả hàng (BE `ReturnRequest.requireReturnable`): đã giao / đang
 * trả; đã hoàn tất hoặc đã hoàn tiền thì chỉ Sale mở, ngoài hạn phải ghi lý do.
 */
export const RETURN_OPENABLE_ORDER_STATUSES = [
  "Delivered",
  "Return Requested",
  "Completed",
  "Refunded",
  "Partially Refunded",
] as const;
/** Đơn đã quá hạn theo định nghĩa (hoàn tất / đã hoàn tiền): luôn cần lý do nhận ngoài hạn. */
export const RETURN_LATE_ORDER_STATUSES = ["Completed", "Refunded", "Partially Refunded"] as const;
/**
 * WF-05 TH-1 (BE `ReturnRequest.requireReturnable`): các lô sau còn đang giao — đơn ở các trạng thái này vẫn mở được yêu
 * cầu trả hàng cho một lô **đã giao** (Luật Thương mại Điều 313, mỗi lần giao xử lý riêng). Không có lô đã giao →
 * BE `RETURN_ORDER_NOT_DELIVERED`.
 */
export const RETURN_OPENABLE_IN_DELIVERY_ORDER_STATUSES = [
  "Picking",
  "Partially Fulfilled",
  "Packed",
  "On Hold",
  "Shipped",
  "Delivery Failed",
] as const;

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
export type ReturnReceiptReadStatus = ReturnReceiptApiStatus | typeof RETURN_UNKNOWN;

/** Chuỗi hiển thị (domain `receipt`). Phiếu hàng hoàn chỉ đi DRAFT → CLOSED / CANCELLED. */
export const RETURN_RECEIPT_STATUS_BY_API = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  CONFIRMED: "Confirmed",
  IN_PUTAWAY: "In Putaway",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
  UNKNOWN: "UNKNOWN",
} as const satisfies Record<ReturnReceiptReadStatus, string>;

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
  /** Hàng lẻ không nhãn (BE `RecordLooseUnitsRequest`). */
  skuMax: 64,
  lotMax: 64,
  /** Ghi chú khi Sale bấm "Đã nhận đủ hàng" (BE `ReturnRequests.GoodsComplete`). */
  goodsCompleteNoteMax: 500,
  /** Ghi chú gửi khách kèm lý do không hoàn (WF-05 Q-4; BE G4 `ReturnRequests.Refund.refusalNote` ≤ 500). */
  refusalNoteMax: 500,
  /** Ảnh hàng lẻ (WF-05 Q-18): như ảnh nhận hàng của phiếu nhập — JPEG / PNG ≤ 20 MB (BE `GoodsReceiptPhotoService`). */
  loosePhotoMaxBytes: 20 * 1024 * 1024,
  loosePhotoTypes: ["image/jpeg", "image/png"],
  locationCodeMax: 64,
  /** Ảnh bằng chứng: JPEG / PNG / WebP ≤ 15 MB, tối đa 10 ảnh (BE `ReturnPolicy.maxEvidence`). */
  evidenceMaxBytes: 15 * 1024 * 1024,
  evidenceMax: 10,
  evidenceTypes: ["image/jpeg", "image/png", "image/webp"],
  /**
   * Biên nhận giữ hộ (WF-05 Q-11, BE G4 `ReturnEvidence.Custody`): SKU ≤ 64 hoặc LPN ≤ 40 (ít nhất một), ≥ 1 đơn vị, ghi
   * chú ≤ 1000; ảnh như ảnh bằng chứng, tối đa `evidenceMax` ảnh giữ hộ.
   */
  custodySkuMax: 64,
  custodyLpnMax: 40,
  custodyNoteMax: 1000,
  /**
   * Hạn đổi / trả mặc định 7 ngày sau giao (hợp đồng có `returnWindowDays` thì theo hợp đồng — BE `policyOf`), hạn gửi
   * hàng về 14 ngày sau duyệt (BE `ReturnPolicy.defaults`).
   */
  windowDays: 7,
  returnDeadlineDays: 14,
  /** Trần `size` của BE (`Pages.MAX_PAGE_SIZE`). */
  pageSizeMax: 200,
} as const;

export const RETURN_STORAGE_KEYS = {
  listConfig: "stockflow:admin:orders:returns:config",
  receiptsConfig: "stockflow:admin:receipts:returns:config",
} as const;
