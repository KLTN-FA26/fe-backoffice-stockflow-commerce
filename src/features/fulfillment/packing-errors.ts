/**
 * Trạm đóng gói — map lỗi BE (PR #136) → câu tiếng Việt. Mã lỗi nghiệp vụ riêng (`PACK_*`,
 * `PACKAGE_*`, `PACKING_*`), nên khác `errors.ts` (task xuất kho chỉ có mã chung): tra theo mã.
 */

import {
  FULFILLMENT_ERROR_MESSAGES,
  PACKING_ERROR_MESSAGES,
  PACKING_INVALID_RESPONSE_MESSAGE,
  PACKING_STALE_ERROR_CODES,
  UI_LABELS,
  PACKING_VALIDATION_FIELD_MESSAGES,
} from "@/constants";
import { ZodError } from "zod";

import { ApiError } from "@/lib/api/error";

import { isStaleFulfillmentError } from "./errors";

type PackingErrorCode = keyof typeof PACKING_ERROR_MESSAGES;
type ValidationField = keyof typeof PACKING_VALIDATION_FIELD_MESSAGES;

const isPackingCode = (code: string): code is PackingErrorCode =>
  Object.hasOwn(PACKING_ERROR_MESSAGES, code);

const isValidationField = (field: string): field is ValidationField =>
  Object.hasOwn(PACKING_VALIDATION_FIELD_MESSAGES, field);

export interface PackingErrorState {
  /** Tên người đang đóng gói đơn (từ phiên) — để câu `PACKING_TAKEN` nêu đúng người. */
  packerName?: string | null;
}

/**
 * `VALIDATION_FAILED` (400): câu theo field BE nêu đầu tiên mà FE biết; không biết thì câu chung.
 * BE không đổi sang tiếng Việt nên không dùng `message` thô.
 */
function validationMessage(error: ApiError): string {
  const fields = Object.keys(error.fieldErrors ?? {});
  const known = fields.find(isValidationField);
  return known
    ? PACKING_VALIDATION_FIELD_MESSAGES[known]
    : FULFILLMENT_ERROR_MESSAGES.VALIDATION_FAILED;
}

/** Câu tiếng Việt cho một lỗi ở trạm đóng gói. */
export function packingErrorMessage(error: unknown, state: PackingErrorState = {}): string {
  if (error instanceof ZodError) return PACKING_INVALID_RESPONSE_MESSAGE;
  if (!(error instanceof ApiError)) return FULFILLMENT_ERROR_MESSAGES.generic;
  if (error.code === "PACKING_TAKEN" && state.packerName) {
    return UI_LABELS.packing.notice.takenTitle(state.packerName);
  }
  if (isPackingCode(error.code)) return PACKING_ERROR_MESSAGES[error.code];
  if (error.code === "VALIDATION_FAILED") return validationMessage(error);
  if (error.code === "NETWORK_ERROR") return FULFILLMENT_ERROR_MESSAGES.NETWORK_ERROR;
  if (error.code === "FORBIDDEN") return FULFILLMENT_ERROR_MESSAGES.FORBIDDEN;
  if (error.code === "OPTIMISTIC_LOCK") return FULFILLMENT_ERROR_MESSAGES.OPTIMISTIC_LOCK;
  if (error.code === "LOCK_TIMEOUT") return FULFILLMENT_ERROR_MESSAGES.LOCK_TIMEOUT;
  if (isStaleFulfillmentError(error)) return FULFILLMENT_ERROR_MESSAGES.stale;
  return FULFILLMENT_ERROR_MESSAGES.generic;
}

/** Phiên đóng gói / task đã đổi ở nơi khác → tải lại phiên (và hàng chờ). */
export function isStalePackingError(error: unknown): boolean {
  // Phản hồi sai hợp đồng: BE có thể đã ghi thao tác → xem lại phiên thật
  if (error instanceof ZodError) return true;
  if (!(error instanceof ApiError)) return false;
  return (
    PACKING_STALE_ERROR_CODES.some((code) => code === error.code) || isStaleFulfillmentError(error)
  );
}

/**
 * Lần gửi có thể chưa tới / chưa xong ở BE (mất mạng, 5xx, khoá bận): giữ nguyên `scanId` /
 * `requestId` và cho gửi lại đúng request đó — BE trả 200 mà không ghi hai lần. Lỗi nghiệp vụ 4xx thì
 * BE đã từ chối và không ghi gì: lần quét kế tiếp dùng id mới. Phản hồi sai hợp đồng (parse lỗi, mọi
 * lỗi không phải `ApiError`) KHÔNG gửi lại cùng id: BE đã trả lời — gửi lại chỉ nhận lại đúng phản hồi
 * hỏng — nên thử lại thủ công dùng id mới sau khi phiên được tải lại.
 */
export function isRetryablePackingError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return (
    error.status === 0 ||
    error.status >= 500 ||
    error.code === "LOCK_TIMEOUT" ||
    error.code === "OPTIMISTIC_LOCK"
  );
}
