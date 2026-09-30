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
  },
} as const;

export const TOAST_MESSAGES = {
  form: {
    saveBlocked: "Chưa thể lưu",
    checkForm: "Kiểm tra lại biểu mẫu",
  },
} as const;
