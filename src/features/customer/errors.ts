/**
 * Lỗi BE → câu tiếng Việt (bundle messages_vi của BE; BE trả message tiếng Anh cho lỗi nghiệp vụ
 * nên FE chọn câu theo `errorCode`).
 */

import { apiErrorMessage } from "@/lib/api/error-message";

export const CUSTOMER_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  CUSTOMER_NOT_FOUND: "Không tìm thấy khách hàng.",
  INVALID_CUSTOMER_STATUS_TRANSITION: "Khách hàng không thể chuyển sang trạng thái này.",
  CUSTOMER_TAX_CODE_ALREADY_EXISTS: "Mã số thuế này đã thuộc về một khách hàng khác.",
  CUSTOMER_EMAIL_ALREADY_EXISTS: "Đã có khách hàng dùng email này.",
  USER_EMAIL_ALREADY_EXISTS: "Email này đã được dùng cho một tài khoản khác.",
  PORTAL_INVITATION_INVALID:
    "Lời mời không hợp lệ hoặc không còn sử dụng được. Vui lòng liên hệ bộ phận bán hàng để nhận lời mời mới.",
  PORTAL_ACCOUNT_ALREADY_ACTIVE: "Khách hàng đã kích hoạt tài khoản portal.",
  PORTAL_INVITATION_UNAVAILABLE:
    "Hệ thống chưa cấu hình gửi lời mời kích hoạt. Vui lòng liên hệ quản trị viên.",
  CREDIT_PROFILE_INVALID: "Điều khoản thanh toán không hợp lệ.",
  LEGAL_PROFILE_NOT_FOUND: "Khách chưa có thông tin pháp lý.",
  CONFLICT: "Khách hàng không còn ở trạng thái chờ kích hoạt.",
  RATE_LIMITED: "Vừa gửi lời mời. Vui lòng chờ khoảng 1 phút rồi gửi lại.",
};

export function customerErrorMessage(error: unknown): string {
  return apiErrorMessage(error, CUSTOMER_ERROR_MESSAGES);
}

/**
 * Câu riêng cho màn hồ sơ pháp lý: `OPTIMISTIC_LOCK` / `VALIDATION_FAILED` ở đây nói về hồ sơ pháp lý, nên không
 * đặt trong `CUSTOMER_ERROR_MESSAGES` (dùng chung với sửa khách, đổi trạng thái).
 */
const LEGAL_PROFILE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  ...CUSTOMER_ERROR_MESSAGES,
  OPTIMISTIC_LOCK: "Thông tin pháp lý vừa được người khác sửa, đã tải lại.",
  VALIDATION_FAILED: "Thông tin pháp lý chưa hợp lệ, kiểm tra lại các ô.",
};

export function legalProfileErrorMessage(error: unknown): string {
  return apiErrorMessage(error, LEGAL_PROFILE_ERROR_MESSAGES);
}

/** Lỗi kích hoạt mật khẩu yếu: BE trả VALIDATION_FAILED không kèm fieldErrors, link vẫn dùng được. */
export const WEAK_PASSWORD_MESSAGE =
  "Mật khẩu cần 10–72 ký tự, có chữ hoa, chữ thường và chữ số. Link vẫn còn hiệu lực, hãy thử lại.";
