import { apiErrorMessage } from "@/lib/api/error-message";

export const MY_ORDER_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  NOT_FOUND: "Không tìm thấy đơn hàng của bạn.",
  CUSTOMER_NOT_FOUND: "Tài khoản chưa gắn hồ sơ khách hàng.",
};

export function myOrderErrorMessage(error: unknown): string {
  return apiErrorMessage(error, MY_ORDER_ERROR_MESSAGES);
}
