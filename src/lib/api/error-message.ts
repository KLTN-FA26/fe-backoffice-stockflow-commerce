import { ApiError } from "./error";

/**
 * Lỗi chung của BE (`common/error/ErrorCode.java`, bundle messages_vi). Lỗi nghiệp vụ 4xx BE trả
 * message TIẾNG ANH (handleBusiness dùng ex.getMessage()), nên FE luôn chọn câu theo `errorCode`.
 */
export const COMMON_API_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  NETWORK_ERROR: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.",
  UNAUTHORIZED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  AUTHORIZATION_UNAVAILABLE: "Chưa kiểm tra được quyền truy cập. Vui lòng thử lại sau.",
  MALFORMED_REQUEST: "Dữ liệu gửi lên không hợp lệ.",
  UNSUPPORTED_PARAMETER: "Giá trị tham số không được hỗ trợ.",
  VALIDATION_FAILED: "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.",
  OPTIMISTIC_LOCK:
    "Người khác vừa thay đổi bản ghi này. Dữ liệu đã được tải lại, vui lòng thử lại.",
  LOCK_TIMEOUT: "Bản ghi đang được xử lý ở nơi khác. Vui lòng thử lại sau giây lát.",
  CONFLICT: "Thao tác không phù hợp với trạng thái hiện tại. Dữ liệu đã được tải lại.",
  RATE_LIMITED: "Bạn thao tác quá nhanh. Vui lòng chờ một chút rồi thử lại.",
  NOT_FOUND: "Không tìm thấy bản ghi.",
  BACKEND_UNAVAILABLE: "Không kết nối được máy chủ nghiệp vụ.",
  PAYLOAD_TOO_LARGE: "Dữ liệu gửi lên quá lớn.",
  CSRF_REJECTED: "Yêu cầu bị từ chối vì không cùng nguồn. Vui lòng tải lại trang.",
};

export const GENERIC_API_ERROR = "Không thực hiện được thao tác. Vui lòng thử lại.";

/** Câu tiếng Việt cho lỗi: map của module → map chung → câu mặc định. Không bao giờ hiện message tiếng Anh của BE. */
export function apiErrorMessage(
  error: unknown,
  messages: Readonly<Record<string, string>> = {},
  fallback = GENERIC_API_ERROR,
): string {
  if (error instanceof ApiError) {
    return messages[error.code] ?? COMMON_API_ERROR_MESSAGES[error.code] ?? fallback;
  }
  return fallback;
}

/** Lỗi "dữ liệu đã đổi ở nơi khác" → màn hình nên tải lại bản ghi trước khi cho thao tác tiếp. */
export function isStaleApiError(error: unknown, extraCodes: readonly string[] = []): boolean {
  return (
    error instanceof ApiError &&
    ["OPTIMISTIC_LOCK", "CONFLICT", "LOCK_TIMEOUT", ...extraCodes].includes(error.code)
  );
}

/** `fieldErrors` của BE (`field` → message) cho react-hook-form; tên trường giữ nguyên. */
export function apiFieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError ? (error.fieldErrors ?? {}) : {};
}
