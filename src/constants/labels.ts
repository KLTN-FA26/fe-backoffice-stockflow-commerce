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
      approve: "Phê duyệt",
      send: "Gửi NCC",
      receive: "Nhận hàng",
      recordConfirmation: "Ghi nhận NCC phản hồi",
      recoverDelivery: "Khôi phục gửi NCC",
      closeShort: "Đóng thiếu",
      cancel: "Huỷ PO",
    },
    validation: {
      supplierRequired: "Chọn nhà cung cấp",
      skuRequired: "Nhập mã SKU",
      skuDuplicate: "SKU bị trùng trong PO",
    },
  },
} as const;

/**
 * BE `errorCode` (ErrorCode.java, nhánh BE `test`) → câu tiếng Việt cho màn PO.
 * Không hiển thị message thô tiếng Anh của BE (có thể chứa UUID).
 */
/** Lỗi BE của form tạo PO (fieldErrors theo tên field BE) → câu tiếng Việt hiện inline dưới ô. */
export const PO_CREATE_FIELD_MESSAGES = {
  supplierId: "Nhà cung cấp không hợp lệ",
  currency: "Tiền tệ không hợp lệ",
  expectedDate: "Ngày giao dự kiến không hợp lệ",
  lines: "Cần ít nhất một dòng hàng",
  skuId: "Mã SKU không hợp lệ",
  description: "Mô tả không hợp lệ",
  orderedQty: "SL đặt không hợp lệ",
  unitPrice: "Đơn giá không hợp lệ",
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
  // Nhận hàng bị BE từ chối bằng 400 chung (IllegalArgumentException, không có field)
  receiveRejected:
    "Máy chủ từ chối số lượng nhận. Kiểm tra SL không vượt “Còn nhận được” — dữ liệu đơn đã được tải lại.",
  // Gửi NCC bị 409 CONFLICT: ngày giao trống/đã qua (PurchaseOrder#confirmDeliveryDate) hoặc
  // NCC ngừng hợp tác / thiếu email-API nhận PO (ProcurementServiceImpl#publishDelivery)
  sendDateInvalid:
    "Chưa gửi được NCC: ngày giao dự kiến phải từ hôm nay trở đi và NCC phải đang hợp tác, có email/API nhận PO",
  generic: "Không thực hiện được thao tác. Vui lòng thử lại.",
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
    // Base UI: BE chưa có endpoint xuất dữ liệu NCC
    exportNotAvailable: "Xuất Excel chưa có API — sẽ nối khi BE hỗ trợ",
  },
  purchaseOrder: {
    created: "Đã tạo đơn đặt hàng",
    possibleDuplicate: "Có thể trùng đơn (BR-PO-003)",
    approved: "Đã phê duyệt đơn",
    sent: "Đã đưa đơn vào hàng đợi gửi NCC",
    deliveryFailed: "Gửi NCC chưa thành công — kiểm tra lịch sử gửi",
    cancelled: "Đã huỷ đơn",
    closedShort: "Đã đóng thiếu đơn",
    received: "Đã ghi nhận nhận hàng",
    deliveryRecovered: "Đã gửi lại đơn cho NCC",
    confirmationRecorded: "Đã ghi nhận phản hồi của NCC",
    actionFailed: "Không thực hiện được thao tác",
    exportNotAvailable: "Xuất Excel chưa có API — sẽ nối khi BE hỗ trợ",
  },
} as const;
