/** Lỗi BE của Bảng sức chứa → câu tiếng Việt; không bao giờ hiện message tiếng Anh của BE. */

import { WAREHOUSE_CAPACITY_ERROR_MESSAGES } from "@/constants";
import { apiErrorMessage } from "@/lib/api/error-message";
import { ApiError } from "@/lib/api/error";

export const capacityErrorMessage = (error: unknown): string =>
  apiErrorMessage(error, WAREHOUSE_CAPACITY_ERROR_MESSAGES);

/** Kho không còn (404) hoặc ngoài phạm vi được giao (403 OUT_OF_DATA_SCOPE) → màn "không tìm thấy kho". */
export const isMissingWarehouse = (error: unknown): boolean =>
  error instanceof ApiError &&
  (error.status === 404 ||
    error.code === "WAREHOUSE_NOT_FOUND" ||
    error.code === "OUT_OF_DATA_SCOPE");
