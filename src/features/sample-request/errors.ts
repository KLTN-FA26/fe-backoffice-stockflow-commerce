/** Lỗi BE → câu tiếng Việt (bundle messages_vi; BE trả message tiếng Anh cho lỗi nghiệp vụ). */

import { apiErrorMessage } from "@/lib/api/error-message";

export const SAMPLE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  NOT_FOUND:
    "Không tìm thấy yêu cầu mẫu, báo giá hoặc thiết kế (hoặc thiết kế không thuộc khách này).",
  INVALID_SAMPLE_REQUEST_TRANSITION:
    "Yêu cầu mẫu không thể chuyển sang trạng thái này lúc này. Dữ liệu đã được tải lại.",
  CUSTOMER_NOT_ACTIVE: "Khách hàng chưa hoạt động nên không thể nhận việc mới.",
  CUSTOMER_NOT_FOUND: "Không tìm thấy khách hàng.",
  SAMPLE_QUOTE_MISMATCH: "Báo giá không dành cho khách hàng, thiết kế và phôi này.",
  QUOTE_NOT_OPEN: "Báo giá không còn mở (chỉ báo giá nháp / đã gửi / chờ sửa).",
  SAMPLE_NEXT_ROUND_EXISTS: "Lần mẫu tiếp theo của yêu cầu này đã được tạo.",
  WAREHOUSE_NOT_FOUND: "Không tìm thấy kho.",
  INSUFFICIENT_STOCK: "Kho không đủ phôi khả dụng để giữ cho mẫu.",
  SKU_NOT_SELLABLE: "Phôi này đã ngừng bán. Chọn phôi đang hoạt động trước khi tiếp tục làm mẫu.",
  CONFLICT:
    "Thiết kế không thuộc sản phẩm của phôi, chưa được xác nhận, hoặc kho đang ngừng hoạt động.",
  OUT_OF_DATA_SCOPE: "Yêu cầu mẫu thuộc kho bạn không được phân công.",
};

export function sampleErrorMessage(error: unknown): string {
  return apiErrorMessage(error, SAMPLE_ERROR_MESSAGES);
}

export const SAMPLE_STALE_CODES = ["INVALID_SAMPLE_REQUEST_TRANSITION"] as const;
