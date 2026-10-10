/**
 * Nhãn UI + nội dung toast dùng lại ≥2 lần (§15 — không hardcode string).
 */

export const UI_LABELS = {
  common: {
    retry: "Thử lại",
    backToList: "Về danh sách",
    backToHome: "Về trang tổng quan",
    traceId: "TraceId",
  },
  // Trạng thái lỗi khi tải dữ liệu (§8 PRODUCTION-FRONTEND-RULES)
  loadError: {
    networkTitle: "Không kết nối được máy chủ",
    networkDescription: "Kiểm tra kết nối mạng rồi thử lại.",
    invalidDataTitle: "Dữ liệu trả về không đúng định dạng",
    invalidDataDescription: "Máy chủ trả dữ liệu sai hợp đồng. Vui lòng báo lại cho kỹ thuật.",
    serverTitle: "Không tải được dữ liệu",
    serverDescription: "Đã xảy ra lỗi khi tải dữ liệu.",
    forbiddenTitle: "Bạn không có quyền",
    noReadTitle: "Bạn không có quyền xem dữ liệu",
    permissionsTitle: "Không tải được quyền truy cập",
    permissionsDescription:
      "Máy chủ chưa trả được danh sách quyền của tài khoản. Thử lại sau hoặc liên hệ quản trị.",
  },
  order: {
    pageTitle: "Đơn hàng",
    cancelFailedTitle: "Không huỷ được đơn",
    notFoundTitle: "Không tìm thấy đơn hàng",
    notFoundDescription: "Đơn hàng không tồn tại hoặc đường dẫn không hợp lệ.",
    forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền truy cập đơn hàng.",
    noReadDescription:
      "Bạn được mở trang nhưng chưa được cấp quyền xem dữ liệu đơn hàng. Liên hệ quản trị để được cấp.",
  },
  supplier: {
    pageTitle: "Nhà cung cấp",
    notFoundTitle: "Không tìm thấy nhà cung cấp",
    notFoundDescription: "Mã nhà cung cấp không tồn tại hoặc đã bị xoá.",
    forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền thao tác này với nhà cung cấp.",
    noReadDescription:
      "Bạn được mở trang nhưng chưa được cấp quyền xem dữ liệu nhà cung cấp. Liên hệ quản trị để được cấp.",
  },
  purchaseOrder: {
    pageTitle: "Đơn đặt NCC",
    notFoundTitle: "Không tìm thấy đơn đặt hàng",
    notFoundDescription: "Đơn đặt hàng không tồn tại hoặc đã bị xoá.",
    forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền thao tác này với đơn đặt hàng.",
    noReadDescription:
      "Bạn được mở trang nhưng chưa được cấp quyền xem dữ liệu đơn đặt hàng. Liên hệ quản trị để được cấp.",
    supplierFilter: "Đang lọc theo NCC",
    clearSupplierFilter: "Bỏ lọc NCC",
    createAction: "Tạo đơn đặt hàng",
    paymentTermDays: "Thời hạn thanh toán",
    leadTimeDays: "Thời gian giao hàng",
    days: "ngày",
    supplierLoading: "Đang tải NCC…",
    invalidSupplierFilterTitle: "Bộ lọc nhà cung cấp không hợp lệ",
    invalidSupplierFilterDescription:
      "Mã nhà cung cấp trên đường dẫn không đúng. Bỏ lọc để xem toàn bộ đơn đặt hàng.",
    supplierUnavailable: "Không tải được tên NCC",
    // Nhãn dùng lại ≥2 chỗ trong module (CLAUDE.md: dùng lại ≥2 lần → constants).
    supplier: "Nhà cung cấp",
    supplierCode: "Mã NCC",
    currency: "Tiền tệ",
    status: "Trạng thái",
    expectedDate: "Ngày giao dự kiến",
    expectedDateShort: "Ngày giao DK",
    lines: "Dòng hàng",
    lineCount: "Số dòng",
    sku: "Mã SKU",
    skuMissing: "Chưa nhập SKU",
    orderedQty: "SL đặt",
    receivedQty: "SL nhận",
    openQty: "SL còn lại",
    unitPrice: "Đơn giá",
    grandTotal: "Tổng giá trị",
    totalAmount: "Tổng tiền",
    totals: "Tổng cộng",
    supplierResponse: "Phản hồi",
    supplierReference: "Mã tham chiếu NCC",
    notUsed: "Chưa dùng",
    /** Cột bảng + panel chi tiết lịch sử gửi NCC. */
    delivery: {
      attemptedAt: "Thời điểm gửi",
      recipient: "Người nhận",
      result: "Kết quả",
      deliveredAt: "Tới NCC lúc",
      actor: "Người cho phép",
      requestedAt: "Thời điểm",
    },
    /** Tên thao tác — nút ở panel hành động và tiêu đề dialog dùng chung. */
    action: {
      submit: "Gửi duyệt",
      approve: "Phê duyệt",
      reject: "Từ chối duyệt",
      send: "Xác nhận & gửi NCC",
      recordConfirmation: "Ghi nhận NCC phản hồi",
      recoverDelivery: "Khôi phục gửi NCC",
      closeShort: "Đóng thiếu",
      close: "Đóng đơn",
      // SCRUM-436: mở màn tạo phiếu nhận cho PO này (không còn nhận trực tiếp trên PO).
      receive: "Nhận hàng",
      cancel: "Huỷ PO",
    },
    validation: {
      supplierRequired: "Chọn nhà cung cấp",
      warehouseRequired: "Chọn kho nhận hàng",
      skuRequired: "Nhập mã SKU",
      skuDuplicate: "SKU bị trùng trong PO",
      descriptionRequired: "Nhập mô tả sản phẩm",
    },
    /** BE #36 `cancellationDeliveryStatus` / `warnings` / `templateCode`. */
    cancellationNotice: "Thông báo huỷ tới NCC",
    deliveryDateInPast:
      "Ngày giao dự kiến đã qua — vẫn tạo và gửi được, nên đổi ngày hoặc thống nhất lại với NCC.",
    template: {
      "purchase-order.sent": "Gửi đơn đặt hàng",
      "purchase-order.cancelled": "Thông báo huỷ",
    },
    templateLabel: "Loại thư",
    /** Cảnh báo thẻ Gửi NCC (`deliveryAlert`). */
    deliveryAlert: {
      recoverable:
        "Lần gửi gần nhất chưa tới được NCC. Kiểm tra lịch sử gửi; người có quyền duyệt có thể khôi phục gửi.",
      retrying:
        "Lần gửi trước chưa tới được NCC — hệ thống đang tự gửi lại, trạng thái sẽ tự cập nhật.",
    },
    /** Lý do một đơn trong danh sách cần xử lý (`poAttentionReason`). */
    attention: {
      deliveryFailed: "Gửi NCC thất bại — cần khôi phục gửi",
      supplierRejected: "NCC từ chối — huỷ và tạo đơn mới",
    },
  },
  receipt: {
    pageTitle: "Phiếu nhận",
    notFoundTitle: "Không tìm thấy phiếu nhận",
    notFoundDescription: "Phiếu nhận không tồn tại hoặc đường dẫn không hợp lệ.",
    forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền thao tác này với phiếu nhận.",
    noReadDescription:
      "Bạn được mở trang nhưng chưa được cấp quyền xem dữ liệu phiếu nhận. Liên hệ quản trị để được cấp.",
    action: {
      create: "Tạo phiếu nhận",
      saveLines: "Lưu kiểm đếm",
      confirm: "Xác nhận nhập kho",
      cancel: "Huỷ phiếu",
      moveToQc: "Chuyển sang khu QC",
      inspect: "Kết luận QC",
    },
    poNotFoundTitle: "Không tìm thấy đơn đặt hàng của phiếu",
    poNotFoundDescription:
      "Không đọc được dòng của đơn đặt hàng nên chưa kiểm đếm được. Phiếu vẫn còn — có thể huỷ phiếu hoặc liên hệ quản trị.",
    noPoReadTitle: "Cần quyền xem đơn đặt hàng",
    noPoReadDescription:
      "Tạo phiếu và kiểm đếm cần đọc dòng của đơn đặt hàng (SL đặt, còn mở). Tài khoản chưa được cấp quyền xem đơn đặt hàng — liên hệ quản trị để được cấp.",
    // Luồng nhận của dòng — BE chốt `qcRequired` theo cờ SKU lúc lưu kiểm đếm (docs 03 §1)
    flow: {
      threeStep: "3 bước · qua QC",
      twoStep: "2 bước · cất thẳng",
    },
    countSaved: "Kết quả kiểm đếm đã lưu",
    countSavedDescription:
      "Số liệu do máy chủ trả về sau khi lưu — luồng của từng dòng chốt theo cờ Yêu cầu QC của SKU.",
    editCount: "Sửa kiểm đếm",
    cancelEdit: "Huỷ sửa",
    // Lý do nút bị khoá (allowedReceiptActions)
    disabledReason: {
      noLines: "Chưa có dòng kiểm đếm — lưu kiểm đếm trước khi xác nhận",
    },
    // Card thao tác khi không còn nút cấp phiếu
    noActions: {
      viewOnly: "Bạn chỉ có quyền xem phiếu nhận.",
      inQc: "QC thực hiện theo từng dòng ở bảng Dòng nhận.",
      inPutaway: "Đang chờ cất hàng lên vị trí lưu trữ (putaway).",
    },
    draftExists: "Đơn này đã có phiếu nhận nháp — mở phiếu đó để kiểm đếm tiếp, tránh đếm trùng:",
    noCountLines: "Chưa có dòng kiểm đếm.",
    linesConfirmedDescription: "Phiếu đã xác nhận chỉ còn xem; QC thực hiện theo từng dòng.",
    linesCancelledDescription: "Phiếu đã huỷ trước khi xác nhận — không nhập kho, chỉ còn xem.",
    dateRangeInvalid: "Ngày bắt đầu sau ngày kết thúc — không có phiếu nào khớp.",
  },
} as const;

/**
 * BE `errorCode` (ErrorCode.java, nhánh BE `test`) → câu tiếng Việt cho màn PO.
 * Không hiển thị message thô tiếng Anh của BE (có thể chứa UUID).
 */
/** Lỗi BE của form tạo PO (fieldErrors theo tên field BE) → câu tiếng Việt hiện inline dưới ô. */
export const PO_CREATE_FIELD_MESSAGES = {
  supplierId: "Nhà cung cấp không hợp lệ",
  warehouseId: "Kho nhận không hợp lệ",
  currency: "Tiền tệ không hợp lệ",
  expectedDate: "Ngày giao dự kiến không hợp lệ",
  note: "Ghi chú không hợp lệ",
  lines: "Cần ít nhất một dòng hàng",
  skuId: "Mã SKU không hợp lệ",
  description: "Mô tả không hợp lệ",
  orderedQty: "SL đặt không hợp lệ",
  unitPrice: "Đơn giá không hợp lệ",
  taxRate: "Thuế suất không hợp lệ",
} as const;

export const PO_ERROR_MESSAGES = {
  INVALID_PURCHASE_ORDER_TRANSITION:
    "Đơn đặt hàng đã đổi trạng thái nên không thể thực hiện thao tác này. Dữ liệu đã được tải lại.",
  PURCHASE_ORDER_NOT_FOUND: "Không tìm thấy đơn đặt hàng",
  SUPPLIER_NOT_FOUND: "Không tìm thấy nhà cung cấp",
  SUPPLIER_INACTIVE: "Nhà cung cấp đã ngừng hợp tác, không thể tạo đơn mới",
  CONFLICT: "Yêu cầu xung đột với dữ liệu hiện tại",
  VALIDATION_FAILED: "Dữ liệu không hợp lệ",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này",
  OUT_OF_DATA_SCOPE: "Đơn đặt hàng này nằm ngoài phạm vi dữ liệu của bạn",
  OPTIMISTIC_LOCK: "Đơn vừa được người khác cập nhật. Dữ liệu đã được tải lại, hãy thử lại.",
  LOCK_TIMEOUT: "Đơn đang được xử lý ở nơi khác, thử lại sau ít giây",
  IDEMPOTENT_REQUEST_IN_PROGRESS: "Yêu cầu trước đó vẫn đang xử lý",
  EXTERNAL_SERVICE_ERROR: "Dịch vụ gửi NCC đang gặp lỗi, thử lại sau",
  AUTHORIZATION_UNAVAILABLE: "Chưa kiểm tra được quyền truy cập, thử lại sau",
  NETWORK_ERROR: "Không kết nối được máy chủ",
  CONTRACT_MISMATCH: "Dữ liệu trả về không đúng định dạng",
  // BE #36 (9fbb90f) — mã lỗi nghiệp vụ PO/NCC. Câu nói rõ cách xử lý: thử lại thường không giúp.
  PO_DELIVERY_DATE_REQUIRED: "Cần ngày giao dự kiến trước khi gửi nhà cung cấp",
  PO_REASON_REQUIRED: "Cần nhập lý do (1–1000 ký tự)",
  PO_SUPPLIER_RESPONSE_INVALID: "Phản hồi của nhà cung cấp phải là Xác nhận hoặc Từ chối",
  PO_COMMUNICATION_NOT_CONFIGURED:
    "Chưa gửi được: hệ thống chưa cấu hình thông tin bên mua (công ty, người liên hệ, địa chỉ kho nhận). Liên hệ quản trị hệ thống — thử lại sẽ không được.",
  PO_LINE_DESCRIPTION_REQUIRED:
    "Có dòng hàng chưa có mô tả sản phẩm nên không gửi được nhà cung cấp. Huỷ PO này và tạo lại, nhập mô tả cho mọi dòng.",
  SUPPLIER_DELIVERY_CONTACT_INVALID:
    "Email/API nhận PO của nhà cung cấp không hợp lệ hoặc chưa được cho phép. Cập nhật hồ sơ nhà cung cấp rồi gửi lại.",
  SUPPLIER_PROFILE_INVALID:
    "Hồ sơ hoặc điều khoản của nhà cung cấp không hợp lệ. Cập nhật hồ sơ nhà cung cấp rồi thử lại.",
  INVALID_SUPPLIER_CONFIRMATION:
    "Không ghi nhận được phản hồi này của nhà cung cấp (đã ghi nhận trước đó hoặc trạng thái không cho phép). Dữ liệu đã được tải lại.",
  // BE PR #71 — luồng duyệt D4, kho nhận, dòng theo inventory item.
  SELF_APPROVAL_NOT_ALLOWED:
    "Bạn đã gửi duyệt đơn này nên không tự duyệt được — cần người khác phê duyệt.",
  INVENTORY_ITEM_NOT_FOUND:
    "Có SKU chưa có dữ liệu kho (inventory item). Kiểm tra lại mã SKU của sản phẩm.",
  WAREHOUSE_NOT_FOUND: "Không tìm thấy kho nhận hàng",
  // Gửi NCC bị 409 CONFLICT (BE ProcurementServiceImpl#publishDelivery): NCC ngừng hợp tác / thiếu
  // email-API nhận PO, hoặc lần gửi đã thành công / bị chặn. Ngày giao đã qua KHÔNG còn bị chặn
  // (BE #36 9fbb90f: chỉ cảnh báo qua `warnings` — BR-06).
  sendSupplierUnavailable:
    "Chưa gửi được nhà cung cấp: nhà cung cấp phải đang hợp tác và có email/API nhận PO, hoặc đơn đã được gửi thành công trước đó.",
  // Khôi phục gửi bị 409 CONFLICT (BE PurchaseOrder#requireDeliveryRecovery + publishDelivery).
  recoverConflict:
    "Chưa gửi lại được: chỉ gửi lại khi lần gửi trước đã thất bại hẳn; nhà cung cấp phải đang hợp tác và có email/API nhận PO. Dữ liệu đã được tải lại.",
  generic: "Không thực hiện được thao tác. Vui lòng thử lại.",
} as const;

/**
 * BE `errorCode` của goods receipt (ErrorCode.java + GoodsReceiptServiceImpl, PR #62) → câu
 * tiếng Việt. Message BE là tiếng Anh, có số PO/UUID — không hiển thị thô.
 */
export const RECEIPT_ERROR_MESSAGES = {
  GOODS_RECEIPT_NOT_FOUND: "Không tìm thấy phiếu nhận",
  PURCHASE_ORDER_NOT_FOUND: "Không tìm thấy đơn đặt hàng của phiếu nhận",
  // BR-01 (docs 03 §6)
  PURCHASE_ORDER_NOT_RECEIVABLE:
    "Đơn đặt hàng chưa chốt hoặc đã nhận xong nên không nhận hàng được. Dữ liệu đã được tải lại.",
  // BR-02 (docs 03 §6)
  OVER_RECEIPT_TOLERANCE: "Số lượng nhận vượt quá SL đặt cộng dung sai của nhà cung cấp",
  // BR-03 / BR-06 (docs 03 §6)
  RECEIPT_LOT_DATA_INVALID:
    "Thông tin lô / hạn dùng không khớp cách theo dõi của SKU (thiếu, thừa, hoặc hạn dùng không sau ngày nhận)",
  LOCATION_NOT_FOUND: "Không tìm thấy mã vị trí",
  // BE gap: cùng mã cho "sai loại khu" lẫn "kho chưa có khu QUALITY_CONTROL" (lúc xác nhận)
  LOCATION_AREA_MISMATCH: "Mã vị trí không đúng loại khu của kho này (nhận hàng / QC / cách ly)",
  INVALID_RECEIPT_TRANSITION:
    "Phiếu nhận đã đổi trạng thái nên không thực hiện được thao tác này. Dữ liệu đã được tải lại.",
  // BR-08 (docs 03 §6)
  QC_QUANTITY_MISMATCH: "Tổng Đạt + Cách ly + Không đạt phải bằng số lượng đã chuyển sang khu QC",
  // BE gap: cùng mã cho trùng dòng PO + lô, dòng không thuộc PO, khu cách ly trùng khu không đạt…
  VALIDATION_FAILED: "Dữ liệu không hợp lệ",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này",
  OPTIMISTIC_LOCK: "Phiếu vừa được người khác cập nhật. Dữ liệu đã được tải lại, hãy thử lại.",
  NETWORK_ERROR: "Không kết nối được máy chủ",
  CONTRACT_MISMATCH: "Dữ liệu trả về không đúng định dạng",
  generic: "Không thực hiện được thao tác. Vui lòng thử lại.",
} as const;

/** Lỗi validate form phiếu nhận (zod Input) — hiện inline dưới ô. */
export const RECEIPT_FIELD_MESSAGES = {
  purchaseOrderRequired: "Chọn đơn đặt hàng",
  linesRequired: "Cần ít nhất một dòng kiểm đếm",
  linesTooMany: "Tối đa 200 dòng mỗi phiếu",
  quantity: "SL nhận phải là số nguyên > 0",
  locationRequired: "Nhập hoặc quét mã vị trí",
  tooLong: "Quá dài",
  lotRequired: "SKU theo dõi lô — nhập số lô",
  expiryRequired: "SKU theo dõi hạn dùng — nhập hạn dùng",
  expiryInvalid: "Ngày không hợp lệ",
  expiryNotAfterReceipt: "Hạn dùng phải sau ngày nhận",
  overLimit: "Tổng SL nhận của dòng PO vượt SL đặt cộng dung sai",
  duplicateLot: "Dòng PO này đã có một dòng cùng số lô — gộp SL của một lô vào một dòng",
  qcSum: "Tổng Đạt + Cách ly + Không đạt phải bằng SL đã chuyển sang khu QC",
  qcQuantity: "Số lượng phải là số nguyên ≥ 0",
  qcLocationRequired: "Nhập mã khu cách ly",
  qcReasonRequired: "Nhập lý do",
  qcSameLocation: "Hàng cách ly và hàng không đạt phải ở hai vị trí khác nhau",
} as const;

/**
 * BE `errorCode` / tên trường ảo → câu tiếng Việt (đã thống nhất: mọi lỗi hiển thị tiếng Việt).
 * Nguồn mã lỗi: BE ErrorCode + SaveSupplierRequest (PR #36).
 */
export const SUPPLIER_ERROR_MESSAGES = {
  SUPPLIER_CODE_ALREADY_EXISTS: "Mã nhà cung cấp đã tồn tại",
  SUPPLIER_TAX_CODE_ALREADY_EXISTS: "Mã số thuế đã thuộc nhà cung cấp khác",
  SUPPLIER_HAS_OPEN_PURCHASE_ORDERS:
    "Nhà cung cấp còn đơn đặt hàng đang mở, không thể ngừng hợp tác",
  SUPPLIER_NOT_FOUND: "Không tìm thấy nhà cung cấp",
  CODE_IMMUTABLE: "Không được đổi mã nhà cung cấp sau khi tạo",
  emailRequiredForEmailChannel: "Kênh Email cần có email liên hệ",
  invalidApiEndpoint:
    "Endpoint phải là địa chỉ https hợp lệ (không có query, fragment, cổng khác 443)",
  invalidPhoneDigits: "Số điện thoại phải có 8–15 chữ số",
  generic: "Dữ liệu không hợp lệ",
} as const;

/** Tên trường NCC bằng tiếng Việt — dùng chung cho form và câu báo lỗi từ BE. */
export const SUPPLIER_FIELD_LABELS = {
  code: "Mã nhà cung cấp",
  /** Dạng gọn cho bảng, card, phần rà soát. */
  codeShort: "Mã NCC",
  name: "Tên nhà cung cấp",
  taxCode: "Mã số thuế",
  contactName: "Người liên hệ",
  email: "Email",
  phone: "Số điện thoại",
  status: "Trạng thái",
  paymentTermDays: "Thời hạn thanh toán",
  leadTimeDays: "Thời gian giao hàng",
  communicationChannel: "Kênh gửi PO",
  apiEndpoint: "API endpoint",
  overReceiptTolerancePercent: "Dung sai nhận vượt",
  printSubcontractor: "NCC in gia công",
  lossTolerancePercent: "Dung sai hao hụt gia công",
  // Trường ảo của BE SaveSupplierRequest (PR #36)
  deliveryContactValid: "Kênh gửi PO",
  phoneDigitsValid: "Số điện thoại",
} as const;

/** Nhãn kênh gửi PO (BE `communicationChannel`) — không hiện enum thô EMAIL/API. */
export const SUPPLIER_CHANNEL_LABELS = {
  EMAIL: "Email",
  API: "API",
} as const;

/** Câu phụ khi BE từ chối dữ liệu đang lưu (vd seed sai định dạng). */
export const SUPPLIER_ERROR_HINTS = {
  invalidDeliveryContact: "Thông tin kênh gửi PO không hợp lệ",
  fixProfile: "cập nhật hồ sơ nhà cung cấp rồi thử lại",
} as const;

export const TOAST_MESSAGES = {
  form: {
    saveBlocked: "Chưa thể lưu",
    checkForm: "Kiểm tra lại biểu mẫu",
  },
  supplier: {
    created: "Tạo nhà cung cấp thành công",
    updated: "Cập nhật nhà cung cấp thành công",
    activated: "Đã kích hoạt lại nhà cung cấp",
    deactivated: "Đã ngừng hợp tác với nhà cung cấp",
    blacklisted: "Đã đưa nhà cung cấp vào danh sách đen",
    // Base UI: BE chưa có endpoint xuất dữ liệu NCC
    exportNotAvailable: "Xuất Excel chưa có API — sẽ nối khi BE hỗ trợ",
  },
  purchaseOrder: {
    created: "Đã tạo đơn đặt hàng",
    possibleDuplicate: "Có thể trùng đơn (BR-PO-003)",
    submitted: "Đã gửi duyệt đơn",
    approved: "Đã phê duyệt đơn",
    rejected: "Đã trả đơn về nháp",
    sent: "Đã xác nhận đơn và đưa vào hàng đợi gửi NCC",
    deliveryFailed: "Gửi NCC chưa thành công — kiểm tra lịch sử gửi",
    cancelled: "Đã huỷ đơn",
    closedShort: "Đã đóng thiếu đơn",
    closed: "Đã đóng đơn",
    deliveryRecovered: "Đã gửi lại đơn cho NCC",
    confirmationRecorded: "Đã ghi nhận phản hồi của NCC",
    actionFailed: "Không thực hiện được thao tác",
    exportNotAvailable: "Xuất Excel chưa có API — sẽ nối khi BE hỗ trợ",
  },
  receipt: {
    created: "Đã tạo phiếu nhận",
    linesSaved: "Đã lưu kiểm đếm",
    confirmed: "Đã xác nhận nhập kho",
    cancelled: "Đã huỷ phiếu nhận",
    movedToQc: "Đã chuyển hàng sang khu QC",
    inspected: "Đã ghi nhận kết luận QC",
  },
} as const;
