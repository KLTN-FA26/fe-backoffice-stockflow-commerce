/** Lỗi BE → câu tiếng Việt (bundle messages_vi; BE trả message tiếng Anh cho lỗi nghiệp vụ). */

import { apiErrorMessage } from "@/lib/api/error-message";

export const QUOTE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  NOT_FOUND: "Không tìm thấy báo giá (hoặc báo giá chưa được gửi cho bạn).",
  CUSTOMER_NOT_FOUND: "Không tìm thấy khách hàng.",
  INVALID_QUOTE_TRANSITION:
    "Báo giá không thể chuyển sang trạng thái này lúc này. Dữ liệu đã được tải lại.",
  QUOTE_EXPIRED: "Báo giá đã hết hiệu lực. Liên hệ Sales để nhận báo giá mới.",
  QUOTE_BELOW_MOQ:
    "Tổng số lượng của phôi thấp hơn số lượng tối thiểu của bậc giá. Tăng số lượng hoặc nhập bậc giá thoả thuận.",
  QUOTE_NOT_PRICED: "Báo giá còn dòng chưa có giá; nhập bậc giá trước khi gửi.",
  DESIGN_SAMPLE_NOT_APPROVED:
    "Có thiết kế chưa được duyệt mẫu. Duyệt mẫu in trước khi chấp nhận báo giá.",
  CUSTOMER_NOT_ACTIVE: "Khách hàng chưa hoạt động nên không thể nhận việc mới.",
  PAYMENT_TERM_NOT_ALLOWED:
    "Điều khoản thanh toán này hiện không áp dụng cho khách. Chọn điều khoản khác.",
  ORDER_NOT_QUOTED: "Đơn này không đặt từ báo giá; hãy đặt lại theo giá hiện hành.",
  PRICE_NOT_AVAILABLE: "Phôi chưa có giá bán hợp lệ; nhập bậc giá thoả thuận.",
  IDEMPOTENCY_KEY_REUSED: "Mã yêu cầu đã được dùng cho một báo giá khác. Tải lại trang và thử lại.",
  SHIPPING_ADDRESS_REQUIRED: "Khách chưa có địa chỉ giao hàng. Bổ sung địa chỉ trước khi tạo đơn.",
  ADDRESS_NOT_FOUND: "Không tìm thấy địa chỉ đã chọn.",
  INSUFFICIENT_STOCK: "Không đủ tồn kho để giữ hàng cho đơn.",
  CONFLICT: "Thiết kế chưa được khách xác nhận, hoặc phôi không thuộc sản phẩm của thiết kế.",
};

export function quoteErrorMessage(error: unknown): string {
  return apiErrorMessage(error, QUOTE_ERROR_MESSAGES);
}

export const QUOTE_STALE_CODES = ["INVALID_QUOTE_TRANSITION", "QUOTE_EXPIRED"] as const;
