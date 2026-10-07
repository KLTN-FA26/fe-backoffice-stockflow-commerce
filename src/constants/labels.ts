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
} as const;
