import { SHIPPING_EVENT_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { shippingErrorMessage } from "./errors";

type EventErrorCode = keyof typeof SHIPPING_EVENT_ERROR_MESSAGES;

function isEventErrorCode(code: string): code is EventErrorCode {
  return Object.hasOwn(SHIPPING_EVENT_ERROR_MESSAGES, code);
}

/** Câu tiếng Việt cho lỗi của màn sự kiện hãng; mã không riêng cho màn này dùng bảng chung của giao hàng. */
export function carrierEventErrorMessage(error: unknown): string {
  if (error instanceof ApiError && isEventErrorCode(error.code)) {
    return SHIPPING_EVENT_ERROR_MESSAGES[error.code];
  }
  return shippingErrorMessage(error);
}
