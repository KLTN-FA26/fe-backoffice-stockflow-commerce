/** Lỗi BE của danh mục đơn vị sản xuất → câu tiếng Việt; không bao giờ hiện message tiếng Anh của BE. */

import { PRODUCTION_ERROR_MESSAGES } from "@/constants";
import { apiErrorMessage, isStaleApiError } from "@/lib/api/error-message";

export const producerErrorMessage = (error: unknown): string =>
  apiErrorMessage(error, PRODUCTION_ERROR_MESSAGES);

/** Dữ liệu đã cũ (version lệch, đơn vị không còn) → tải lại danh sách để lần thử sau gửi đúng `version`. */
export const isStaleProducerError = (error: unknown): boolean =>
  isStaleApiError(error, ["PRODUCER_NOT_FOUND"]);
