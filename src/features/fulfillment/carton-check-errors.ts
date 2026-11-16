/**
 * Trạm kiểm thùng — map lỗi BE (4C-6) → câu tiếng Việt. Mã lỗi nghiệp vụ riêng (`PACK_*`, `PACKING_*`, `CARTON_*`,
 * `PACKAGE_SHIPPED`), nên khác `errors.ts` (task xuất kho chỉ có mã chung): tra theo mã.
 */

import { ZodError } from "zod";

import {
  CARTON_CHECK_ERROR_MESSAGES,
  CARTON_CHECK_INVALID_RESPONSE_MESSAGE,
  CARTON_CHECK_STALE_ERROR_CODES,
  CARTON_CHECK_VALIDATION_FIELD_MESSAGES,
  CARTON_NOT_CHECKED_MESSAGES,
  CARTON_SPEC_UNMEASURED_MESSAGES,
  FULFILLMENT_ERROR_MESSAGES,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import { isStaleFulfillmentError } from "./errors";

type CartonCheckErrorCode = keyof typeof CARTON_CHECK_ERROR_MESSAGES;
type ValidationField = keyof typeof CARTON_CHECK_VALIDATION_FIELD_MESSAGES;

/** Thao tác nào đang chạy — `CARTON_NOT_CHECKED` đổi nghĩa theo thao tác. */
export type CartonCheckErrorContext = "label" | "print" | "reprint";

const isCartonCheckCode = (code: string): code is CartonCheckErrorCode =>
  Object.hasOwn(CARTON_CHECK_ERROR_MESSAGES, code);

const isValidationField = (field: string): field is ValidationField =>
  Object.hasOwn(CARTON_CHECK_VALIDATION_FIELD_MESSAGES, field);

export interface CartonCheckErrorState {
  /** Tên người đang kiểm thùng đơn (từ phiên) — để câu `PACKING_TAKEN` nêu đúng người. */
  starterName?: string | null;
  context?: CartonCheckErrorContext;
}

/** `VALIDATION_FAILED` (400): câu theo field BE nêu đầu tiên mà FE biết; không biết thì câu chung. */
function validationMessage(error: ApiError): string {
  const known = Object.keys(error.fieldErrors ?? {}).find(isValidationField);
  return known
    ? CARTON_CHECK_VALIDATION_FIELD_MESSAGES[known]
    : FULFILLMENT_ERROR_MESSAGES.VALIDATION_FAILED;
}

/** BE nêu từng SKU thiếu quy cách thùng trong `fieldErrors[{ field: "sku", message: <sku> }]` (docs 08 BR-07). */
function unmeasuredMessage(error: ApiError): string {
  const skus = (error.fieldErrorList ?? [])
    .filter((entry) => entry.field === "sku")
    .map((entry) => entry.message);
  return skus.length > 0
    ? CARTON_SPEC_UNMEASURED_MESSAGES.withSkus(skus.join(", "))
    : CARTON_SPEC_UNMEASURED_MESSAGES.generic;
}

/** Câu tiếng Việt cho một lỗi ở trạm kiểm thùng. */
export function cartonCheckErrorMessage(error: unknown, state: CartonCheckErrorState = {}): string {
  if (error instanceof ZodError) return CARTON_CHECK_INVALID_RESPONSE_MESSAGE;
  if (!(error instanceof ApiError)) return FULFILLMENT_ERROR_MESSAGES.generic;
  if (error.code === "PACKING_TAKEN" && state.starterName) {
    return UI_LABELS.cartonCheck.notice.takenTitle(state.starterName);
  }
  if (error.code === "CARTON_NOT_CHECKED") {
    return CARTON_NOT_CHECKED_MESSAGES[state.context ?? "generic"];
  }
  if (error.code === "CARTON_SPEC_UNMEASURED") return unmeasuredMessage(error);
  if (isCartonCheckCode(error.code)) return CARTON_CHECK_ERROR_MESSAGES[error.code];
  if (error.code === "VALIDATION_FAILED") return validationMessage(error);
  if (error.code === "NETWORK_ERROR") return FULFILLMENT_ERROR_MESSAGES.NETWORK_ERROR;
  if (error.code === "FORBIDDEN") return FULFILLMENT_ERROR_MESSAGES.FORBIDDEN;
  if (error.code === "OPTIMISTIC_LOCK") return FULFILLMENT_ERROR_MESSAGES.OPTIMISTIC_LOCK;
  if (error.code === "LOCK_TIMEOUT") return FULFILLMENT_ERROR_MESSAGES.LOCK_TIMEOUT;
  if (isStaleFulfillmentError(error)) return FULFILLMENT_ERROR_MESSAGES.stale;
  return FULFILLMENT_ERROR_MESSAGES.generic;
}

/** Phiên kiểm thùng / task đã đổi ở nơi khác → tải lại phiên (và hàng chờ). */
export function isStaleCartonCheckError(error: unknown): boolean {
  // Phản hồi sai hợp đồng: BE có thể đã ghi thao tác → xem lại phiên thật
  if (error instanceof ZodError) return true;
  if (!(error instanceof ApiError)) return false;
  return (
    CARTON_CHECK_STALE_ERROR_CODES.some((code) => code === error.code) ||
    isStaleFulfillmentError(error)
  );
}
