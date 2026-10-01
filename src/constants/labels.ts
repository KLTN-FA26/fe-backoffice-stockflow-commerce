/**
 * Nhãn UI + nội dung toast dùng lại ≥2 lần (§15 — không hardcode string).
 */

export const UI_LABELS = {
  common: {
    retry: "Thử lại",
    backToList: "Về danh sách",
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
  },
  supplier: {
    pageTitle: "Nhà cung cấp",
    notFoundTitle: "Không tìm thấy nhà cung cấp",
    notFoundDescription: "Mã nhà cung cấp không tồn tại hoặc đã bị xoá.",
    forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền thao tác này với nhà cung cấp.",
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

export const TOAST_MESSAGES = {
  form: {
    saveBlocked: "Chưa thể lưu",
    checkForm: "Kiểm tra lại biểu mẫu",
  },
} as const;
