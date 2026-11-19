/** Lỗi BE của Đơn sản xuất → câu tiếng Việt; không bao giờ hiện message tiếng Anh của BE. */

import { PRODUCTION_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { apiErrorMessage, isStaleApiError } from "@/lib/api/error-message";

export const productionOrderErrorMessage = (error: unknown): string =>
  apiErrorMessage(error, PRODUCTION_ERROR_MESSAGES);

/**
 * Dữ liệu đã cũ: version lệch, trạng thái đã đổi ở nơi khác, đợt hết thiếu — tải lại đơn / lịch để lần thử sau đúng.
 */
export const isStaleProductionOrderError = (error: unknown): boolean =>
  isStaleApiError(error, [
    "PRODUCTION_ORDER_STATUS_INVALID",
    "PRODUCTION_ORDER_NOTHING_SHORT",
    "PRODUCTION_ORDER_NOT_FOUND",
  ]);

export const isForbiddenError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 403 || error.code === "FORBIDDEN");

export const isNotFoundError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 404 || error.code === "OUT_OF_DATA_SCOPE");
