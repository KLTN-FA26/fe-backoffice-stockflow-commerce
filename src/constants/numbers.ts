/**
 * Ngưỡng số dùng ≥2 chỗ. Mỗi giá trị cite nguồn (docs hoặc ràng buộc BE).
 */

/** Giới hạn đơn đặt NCC — lấy đúng ràng buộc DB/BE nhánh `test` (BE request chưa có @Size). */
export const PO_LIMITS = {
  /** BE `purchase_order_lines.note VARCHAR(255)` (BE PR #71). */
  lineDescriptionMax: 255,
  /** BE lý do khôi phục / đổi ngày giao 1..1000. */
  reasonMax: 1000,
  /** BE `purchase_orders.cancel_reason` / `close_reason VARCHAR(255)` (BE PR #71). */
  closeReasonMax: 255,
  /** BE lý do từ chối duyệt — `purchase_order_approvals.reason VARCHAR(500)`. */
  rejectReasonMax: 500,
  /** BE `UpdatePurchaseOrderRequest.lines` @Size(max = 200). */
  linesMax: 200,
  /** BE `purchase_orders.note TEXT`, giới hạn ở request 2000. */
  noteMax: 2000,
  /** BE `SupplierConfirmationRequest.supplierReference` @Size(max = 100). */
  supplierReferenceMax: 100,
  /** BE `int quantityOrdered` (Java int). */
  quantityMax: 2_147_483_647,
  /**
   * Chu kỳ tải lại PO + lần gửi khi đang gửi NCC (QUEUED / RETRYING). BE gửi bất đồng bộ
   * (`@ApplicationModuleListener`) — thường xong sau ~1 giây; dừng khi DELIVERED / FAILED.
   */
  deliveryPollMs: 3000,
} as const;

export const ORDER_LIMITS = {
  /**
   * Độ dài tối đa lý do huỷ đơn — cột `ordering.orders.cancellation_reason VARCHAR(500)`
   * (BE migration V20260901000300__ordering_orders.sql). `AdminCancelOrderRequest` chỉ có
   * @NotBlank nên FE phải chặn, quá dài → DB từ chối → BE trả 500.
   */
  cancelReasonMax: 500,
  /** `HoldOrderRequest.note` @Size(max = 1000) — BE PR #133. */
  holdNoteMax: 1000,
  /** `ResolveHoldRequest.note` @NotBlank @Size(max = 1000). */
  resolveNoteMax: 1000,
  /** `DeliveryFailureRequest.note` @Size(max = 500). */
  deliveryFailureNoteMax: 500,
  /** `CloseRemainderRequest.note` @Size(max = 1000). */
  remainderClosureNoteMax: 1000,
} as const;

/** Giới hạn phiếu nhận — đúng ràng buộc request BE goods receipt (PR #62, SCRUM-435). */
export const RECEIPT_LIMITS = {
  /** `ReceiptLinesRequest.lines` @Size(max = 200). */
  linesMax: 200,
  /** `ReceiptLinesRequest.Line.lotNumber` / `locationCode` @Size(max = 64); `MoveToQcRequest`. */
  codeMax: 64,
  /** `ReceiptLinesRequest.Line.note` @Size(max = 255). */
  lineNoteMax: 255,
  /** `CreateGoodsReceiptRequest.deliveryNote` @Size(max = 100). */
  deliveryNoteMax: 100,
  /** `CreateGoodsReceiptRequest.note` @Size(max = 2000). */
  noteMax: 2000,
  /** `QcDecisionRequest.Part.reason` @Size(max = 500). */
  qcReasonMax: 500,
} as const;

/** Giới hạn task xuất kho — đúng ràng buộc request BE FulfillmentController. */
export const FULFILLMENT_LIMITS = {
  /** `ReverificationRequest.resolutionNote` @NotBlank @Size(max = 1000). */
  resolutionNoteMax: 1000,
  /** Số ký tự đầu của checksum SHA-256 (64 hex) hiện trong bảng — đủ để đối chiếu bằng mắt. */
  checksumPreviewLength: 12,
  /** Số ký tự CUỐI của UUID hiện khi BE không trả mã đọc được (task, đơn, người được gán). */
  shortIdLength: 8,
} as const;

/** Giới hạn lệnh chuyển kho — đúng ràng buộc request BE (CreateTransferOrderRequest, ReasonRequest). */
export const TRANSFER_LIMITS = {
  /** `lines` @Size(max = 200). */
  linesMax: 200,
  /** `Line.quantity` @Max(1_000_000). */
  quantityMax: 1_000_000,
  /** `Line.lotNumber` @Size(max = 64); SKU @Pattern `[A-Za-z0-9-]{3,64}`. */
  codeMax: 64,
  skuMin: 3,
  /** `ReasonRequest.reason` @Size(max = 500). */
  reasonMax: 500,
  /**
   * `stockflow.inventory.transfer.approval-threshold-units` (mặc định 100; docs 10 §4 bước 3 + §5 "Draft → Approved: Submit (dưới ngưỡng)"): tổng SL ≤ ngưỡng
   * thì gửi duyệt là duyệt luôn. Chỉ để hiện gợi ý — BE đọc cấu hình thật.
   */
  approvalThresholdUnits: 100,
} as const;

/** Giới hạn thương hiệu / danh mục — BE `Create*Request` / `Update*Request` + migration PIM dictionary. */
export const TAXONOMY_LIMITS = {
  /** `name` @Size(max = 255). */
  nameMax: 255,
  /** `CreateCategoryRequest.seoTitle` @Size(max = 255). */
  seoTitleMax: 255,
  /**
   * Cấp sâu nhất còn nhận con: `ProductTaxonomyService.createCategory` từ chối cha có depth ≥ 10
   * (400 VALIDATION_FAILED, cây tối đa 11 cấp — CHECK `ck_categories_depth` 0–10).
   */
  maxParentDepth: 9,
  /**
   * Ô chọn danh mục cha / cây danh mục tải hết các trang 200 dòng (`Pages.MAX_PAGE_SIZE`) thay vì
   * cắt ở trang đầu; chặn trên 25 trang (5000 bản ghi) để không lặp vô hạn nếu BE trả sai `hasNext`.
   */
  maxLookupPages: 25,
} as const;

/** Giới hạn chính sách tồn — BE PR #119. */
export const INVENTORY_POLICY_LIMITS = {
  /** `UpdateItemPolicyRequest.maxShelfLifeDays` @Min(1) @Max(36500). */
  maxShelfLifeDaysMin: 1,
  maxShelfLifeDaysMax: 36500,
} as const;

/** Ô quét mã vạch dùng chung (`use-scan-tone`). */
export const SCAN_LIMITS = {
  /** Chờ trình duyệt mở AudioContext tối đa — quá thì bỏ tiếng báo đang chờ. */
  audioResumeTimeoutMs: 1000,
} as const;

/** Xếp xe & bàn giao — ASSUMPTION theo contract đề xuất SCRUM-288 (BE chưa có request). */
export const SHIPPING_LIMITS = {
  scanCodeMax: 64,
  carrierRepresentativeMax: 100,
  noteMax: 500,
  /** Thời gian giữ màu phản hồi sau mỗi lần quét. */
  scanFeedbackMs: 1500,
  /** Biên bản đang đối soát (LOADING): tự tải lại để thấy kiện quét từ máy khác. */
  manifestPollMs: 15_000,
} as const;

/**
 * Danh mục hàng NCC — nguồn BE: `SupplierItemTerms` (mã NCC, lead time), `PurchasePrices`
 * (số lẻ giá, tối đa 2 và không vượt số lẻ tiền tệ), `Pages.MAX_PAGE_SIZE`.
 */
export const SUPPLIER_ITEM_LIMITS = {
  supplierSkuCodeMax: 50,
  leadTimeDaysMax: 365,
  priceMaxScale: 2,
  // BE `SaveSupplierItemRequest.price` @Digits(integer = 16) + `PurchasePrices.MAX` (numeric(18,2))
  priceIntegerDigitsMax: 16,
  // BE `moq` / `packSize` là `Integer` Java — quá int32 thì Jackson không bind được (400 chung)
  intMax: 2_147_483_647,
  catalogPageSize: 200,
} as const;

/**
 * Số gợi ý mỗi lần tìm hồ sơ hàng tồn (`GET /inventory/items?q=`) ở ô chọn SKU — bằng
 * `Pages.DEFAULT_PAGE_SIZE` của BE (tối đa `Pages.MAX_PAGE_SIZE` 200); gõ thêm để thu hẹp.
 */
export const INVENTORY_ITEM_OPTIONS_PAGE_SIZE = 20;
