/**
 * Ngưỡng số dùng ≥2 chỗ. Mỗi giá trị cite nguồn (docs hoặc ràng buộc BE).
 */

/**
 * Dropdown năm của `DatePicker`: số năm trước / sau năm hiện tại. Chỉ là phạm vi điều hướng của UI
 * (hạn dùng, ngày giao…), không phải ràng buộc BE — `min` / `max` của từng ô vẫn chặn riêng.
 */
export const DATE_PICKER_YEAR_SPAN = { back: 10, ahead: 10 } as const;

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
  /** `PartialShipmentRequest.note` @Size(max = 500) — BE PR #150. */
  partialShipmentNoteMax: 500,
  /** `DeliveryModeRequest.note` @Size(max = 500) — BE PR #157. */
  deliveryModeNoteMax: 500,
  /** `CancellationFeeRequest.reason` @Size(max = 500) — `CloseRemainderRequest.agreedFee` (BE PR #150). */
  feeReasonMax: 500,
  /** `CancellationFeeRequest.detail` @Size(max = 2000). */
  feeDetailMax: 2000,
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

/** Dòng lấy hàng — đúng ràng buộc BE (SCRUM-267/275, PR #147). */
export const PICK_LINE_LIMITS = {
  /** `ConfirmPickRequest.locationCode / scannedCode`, `ShortPickRequest.locationCode` @Size(max = 64). */
  codeMax: 64,
  /** Một trang dòng lấy hàng — `Pages.MAX_PAGE_SIZE` (task dài hơn thì tải tiếp trang sau). */
  pageSize: 200,
  /** Ô tìm của hàng đợi trả về kệ lọc ở client — debounce 300ms (api-conventions §9). */
  searchDebounceMs: 300,
} as const;

/**
 * Giới hạn trạm đóng gói — đúng ràng buộc request BE PR #136 (`PackScanRequest`, `SealPackageRequest`,
 * `PackingCompletionRequest`, `OpenPackageRequest`).
 */
export const PACKING_LIMITS = {
  /** `PackScanRequest.quantity` @Positive @Max(1_000_000); `removeUnits.quantity` cùng giới hạn. */
  quantityMax: 1_000_000,
  /** `PackScanRequest.scannedCode` @NotBlank @Size(max = 64). */
  scannedCodeMax: 64,
  /** `PackScanRequest.lotNumber` @Size(max = 64). */
  lotMax: 64,
  /** `PackScanRequest.serialNumber` @Size(max = 100). */
  serialMax: 100,
  /** `PackingCompletionRequest.note` @Size(max = 500) — bắt buộc khi giao một phần. */
  noteMax: 500,
  /** `SealPackageRequest.weightKg` @Digits(integer = 7, fraction = 3) @Positive. */
  weightKgMax: 9_999_999.999,
  weightKgScale: 3,
  /** `SealPackageRequest.lengthCm/widthCm/heightCm` @DecimalMax("100000") @Digits(fraction = 2). */
  dimensionCmMax: 100_000,
  dimensionCmScale: 2,
  /** Thời gian giữ màu phản hồi sau mỗi lần quét đúng. */
  scanFeedbackMs: 1500,
} as const;

/** Giới hạn đóng gói chuyển kho — request BE `TransferCartonRequest`, `TransferKitRequest`, `PackingCompletionRequest`. */
export const TRANSFER_PACK_LIMITS = {
  /** `TransferCartonRequest.lpn` @NotBlank @Size(max = 30). */
  lpnMax: 30,
  /** `TransferKitRequest.partCount` @Min(2) @Max(99). */
  kitPartsMin: 2,
  kitPartsMax: 99,
  /** `PackingCompletionRequest.note` @Size(max = 500) — bắt buộc khi chỉ chuyển phần đã đóng. */
  noteMax: 500,
  /** `kitOverrideReason` @Size(max = 500) (KIT-FORCE). */
  kitReasonMax: 500,
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

/**
 * Xếp xe & bàn giao — độ dài tối đa theo BE `LoadScanRequest` / `OpenLoadRequest` / `HandoverRequest`
 * / `CancelLoadRequest` / `DeliveryOutcomeRequest` (PR #137).
 */
export const SHIPPING_LIMITS = {
  scanCodeMax: 48,
  carrierRepresentativeMax: 120,
  vehiclePlateMax: 20,
  driverNameMax: 120,
  driverPhoneMax: 32,
  signatureRefMax: 255,
  noteMax: 500,
  cancelReasonMax: 500,
  /** `LoadShipmentsRequest.shipmentIds` / `OpenLoadRequest.shipmentIds`. */
  shipmentIdsMax: 200,
  /** Thời gian giữ màu phản hồi sau mỗi lần quét. */
  scanFeedbackMs: 1500,
  /** Chuyến đang xếp hàng (LOADING): tự tải lại để thấy kiện quét từ máy khác. */
  loadPollMs: 15_000,
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

/**
 * Giới hạn danh mục loại xe — `VehicleTypeRequest` / `ck_vehicle_type_*` của BE PR #153. Kích thước
 * trong xe tính bằng mm, tải trọng kg; khe góc (gusset) chừa ở mỗi góc trên trần (docs 09 BR-10).
 */
export const VEHICLE_TYPE_LIMITS = {
  codeMin: 2,
  codeMax: 32,
  nameMax: 120,
  /** `innerLengthMm` / `innerWidthMm` / `innerHeightMm` @Min(1) @Max(30000). */
  dimensionMaxMm: 30000,
  /** `gussetMm` @Min(0) @Max(1000). */
  gussetMaxMm: 1000,
  /** `doorWidthMm` / `doorHeightMm` @Min(1) @Max(30000): cùng trần với kích thước trong. */
  doorMaxMm: 30000,
  /** `maxPayloadKg` @DecimalMax("100000") (> 0), tối đa 3 số lẻ. */
  payloadMaxKg: 100000,
  payloadFractionDigits: 3,
  /** `availableCount` @Min(0) @Max(10000). */
  availableCountMax: 10000,
  /** `rentalPrice` @Digits(integer = 15, fraction = 4): giá thuê tham khảo (VND). */
  rentalPriceIntegerDigits: 15,
  rentalPriceFractionDigits: 4,
  /** mm → m, và mm³ → m³ (giá trị = mm³ / 1e9). */
  mmPerMetre: 1000,
  cubicMmPerCubicMetre: 1_000_000_000,
} as const;

/**
 * Xếp hàng lên xe (SCRUM-287/391/392, design v2 §1) — số lấy nguyên từ solver và viewer gốc
 * (`nesting-standalone`: `solver_3d_kit.py`, `manual-packing.ts`, `steps.ts`, `nesting-3d-viewer.tsx`).
 */
export const LOAD_ESTIMATE_LIMITS = {
  /** `LoadEstimateRequest.vehicleTypeIds` @Size(max = 20) — BE PR #160. */
  vehicleTypesMax: 20,
  /** Một trang tối đa của BE (`Pages.MAX_PAGE_SIZE`): đủ để chọn loại xe đang dùng mà không phân trang. */
  vehicleTypesPageSize: 200,
} as const;

export const LOAD_PLANNING_LIMITS = {
  /** BR-10 (docs 09-shipping §6): kiện phải được đỡ ≥ 98% mặt đáy — khớp solver `_support`, design §1 "Rules". */
  minSupportRatio: 0.98,
  /** Dung sai hình học (mm) cho "chạm/chồng nhau" — cùng cỡ `_EPS` của solver. */
  geometryEpsilonMm: 0.5,
  /** Dung sai (mm) khi gộp các kiện cùng mặt hàng thành một khối xếp (`steps.ts` TOL). */
  blockAdjacencyToleranceMm: 3,
  /** Khoảng trống nhỏ hơn mức này (mm) không chứa nổi thùng nào nên bỏ (`computeEmptySpaces`). */
  minEmptySpaceMm: 50,
  /** Van an toàn: tối đa số khoảng trống giữ lại khi tính vùng trống (`MAX_SPACES`). */
  emptySpacesMax: 1500,
  /** Tối đa số ô gợi ý chỗ đặt hiển thị cùng lúc (hàng trăm mesh làm chậm khung 3D). */
  landingGhostsMax: 300,
  /** Viewer chỉ dựng tối đa chừng này kiện (gốc: `slice(0, 600)`); quá mức thì hiện cảnh báo. */
  renderBoxesMax: 600,
  /** Hiệu suất thể tích dưới mức này bị tô cảnh báo (viewer gốc dùng 50%). */
  lowUtilizationRatio: 0.5,
  /** Chiều cao khung 3D (px) — skeleton khi tải dùng cùng giá trị để bố cục không nhảy (gốc: 360). */
  viewerHeightPx: 360,
  /** Chiều cao khung 3D của trình soạn xếp tay (px; gốc `canvasHeight` = 560, thu lại để vừa cạnh khay). */
  editorViewerHeightPx: 520,
  /** Bước nhích tay (mm) — `NUDGE_STEP` của `manual-packing-editor.tsx`; nhích dừng sát vật cản nếu gần hơn. */
  nudgeStepMm: 50,
  /** Số bước hoàn tác giữ lại (gốc 20; trạng thái chia sẻ mảng kiện nên giữ nhiều cũng nhẹ). */
  editorHistoryMax: 50,
  /** Lớp phủ "xem chỗ trống" chỉ vẽ chừng này khoảng trống lớn nhất (gốc `slice(0, 40)`). */
  emptySpacesShownMax: 40,
  /** Số bước xếp chụp ảnh liền một nhịp trên trang in trước khi nhường luồng để thanh tiến độ cập nhật. */
  captureChunkSteps: 6,
} as const;

/**
 * Kế hoạch xếp xe — giới hạn của `CreateLoadPlanRequest` / `LoadPlanInputsRequest` / `LoadPlanReasonRequest` /
 * `VehicleRecalculationRequest` (BE PR #161) và ngưỡng cờ so với ước lượng.
 */
export const LOAD_PLAN_LIMITS = {
  /** `shipmentIds` @Size(max = 200). */
  shipmentsMax: 200,
  /** `transferOrderIds` @Size(max = 1): kế hoạch nguồn TRANSFER chứa đúng một lệnh chuyển kho (BE PR #164). */
  transferOrdersMax: 1,
  /** `vehicleTypeIds` @Size(max = 50). */
  vehicleTypesMax: 50,
  /** `reason` @NotBlank @Size(max = 500) khi mở lại / huỷ. */
  reasonMax: 500,
  /** `note` @Size(max = 500). */
  noteMax: 500,
  /** `addPackageIds` @Size(max = 500). */
  addPackagesMax: 500,
  /** Cờ VOLUME_ABOVE / WEIGHT_ABOVE / MORE_PARCELS: vượt ước lượng quá 10% (BE `LoadPlanEstimateComparison`). */
  estimateTolerancePct: 10,
  /** Số loại xe tải về một lần cho ô chọn loại xe (danh mục tối đa vài chục). */
  vehicleTypePickerSize: 100,
  /** `LoadPlacementsRequest.vehicles` @Size(max = 100). */
  placementVehiclesMax: 100,
  /** `LoadPlacementsRequest.Vehicle.boxes` và `tray` @Size(max = 2000). */
  placementBoxesMax: 2000,
} as const;
