import { apiErrorMessage } from "@/lib/api/error-message";

export const MY_ORDER_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  NOT_FOUND: "Không tìm thấy đơn hàng của bạn.",
  CUSTOMER_NOT_FOUND: "Tài khoản chưa gắn hồ sơ khách hàng.",
  ORDER_NOT_QUOTED: "Đơn này không đặt từ báo giá; hãy liên hệ Sales để đặt theo giá hiện hành.",
  CUSTOMER_NOT_ACTIVE: "Tài khoản khách đang không hoạt động nên chưa gửi được yêu cầu.",
  IDEMPOTENCY_KEY_REUSED: "Yêu cầu đã được gửi trước đó.",
};

export function myOrderErrorMessage(error: unknown): string {
  return apiErrorMessage(error, MY_ORDER_ERROR_MESSAGES);
}
