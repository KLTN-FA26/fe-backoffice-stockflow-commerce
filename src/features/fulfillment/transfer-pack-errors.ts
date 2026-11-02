/**
 * Đóng gói chuyển kho — map lỗi BE (`TransferPackController`, BE PR #164) → câu tiếng Việt. Tra theo `errorCode`
 * (không hiện message tiếng Anh của BE); mã dùng chung với trạm đóng gói đơn lấy câu đã đổi chữ "đơn" → "lệnh".
 */

import { ZodError } from "zod";

import {
  FULFILLMENT_ERROR_MESSAGES,
  PACKING_INVALID_RESPONSE_MESSAGE,
  TRANSFER_PACK_ERROR_MESSAGES,
  TRANSFER_PACK_STALE_ERROR_CODES,
  TRANSFER_PACK_VALIDATION_FIELD_MESSAGES,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import { isStaleFulfillmentError } from "./errors";

type TransferPackErrorCode = keyof typeof TRANSFER_PACK_ERROR_MESSAGES;
type ValidationField = keyof typeof TRANSFER_PACK_VALIDATION_FIELD_MESSAGES;

const isKnownCode = (code: string): code is TransferPackErrorCode =>
  Object.hasOwn(TRANSFER_PACK_ERROR_MESSAGES, code);

const isValidationField = (field: string): field is ValidationField =>
  Object.hasOwn(TRANSFER_PACK_VALIDATION_FIELD_MESSAGES, field);

export interface TransferPackErrorState {
  /** Tên người đang đóng gói lệnh (nếu biết) — để câu `PACKING_TAKEN` nêu đúng người. */
  packerName?: string | null;
}

/** `VALIDATION_FAILED` (400): câu theo field BE nêu đầu tiên mà FE biết; không biết thì câu chung. */
function validationMessage(error: ApiError): string {
  const known = Object.keys(error.fieldErrors ?? {}).find(isValidationField);
  return known
    ? TRANSFER_PACK_VALIDATION_FIELD_MESSAGES[known]
    : FULFILLMENT_ERROR_MESSAGES.VALIDATION_FAILED;
}

/**
 * BE #164 (`TransferOrderServiceImpl#rehold`): `INSUFFICIENT_STOCK` kèm `fieldErrors` `sku` (SKU thiếu) và `shortfall` (số đơn
 * vị thiếu) — đọc từ đó, không phân tích message tiếng Anh. Thiếu field thì dùng câu chung.
 */
function insufficientStockMessage(error: ApiError): string {
  const base = TRANSFER_PACK_ERROR_MESSAGES.INSUFFICIENT_STOCK;
  const sku = error.fieldErrors?.sku;
  const shortfall = Number(error.fieldErrors?.shortfall);
  if (!sku) return base;
  return Number.isFinite(shortfall) && shortfall > 0
    ? `${base} SKU ${sku}: thiếu ${shortfall}.`
    : `${base} SKU ${sku}.`;
}

/** Câu tiếng Việt cho một lỗi ở trạm đóng gói chuyển kho. */
export function transferPackErrorMessage(
  error: unknown,
  state: TransferPackErrorState = {},
): string {
  if (error instanceof ZodError) return PACKING_INVALID_RESPONSE_MESSAGE;
  if (!(error instanceof ApiError)) return FULFILLMENT_ERROR_MESSAGES.generic;
  if (error.code === "PACKING_TAKEN" && state.packerName) {
    return UI_LABELS.transferPack.notice.takenByOther(state.packerName);
  }
  if (error.code === "INSUFFICIENT_STOCK") return insufficientStockMessage(error);
  if (isKnownCode(error.code)) return TRANSFER_PACK_ERROR_MESSAGES[error.code];
  if (error.code === "VALIDATION_FAILED") return validationMessage(error);
  if (error.code === "NETWORK_ERROR") return FULFILLMENT_ERROR_MESSAGES.NETWORK_ERROR;
  if (error.code === "FORBIDDEN") return FULFILLMENT_ERROR_MESSAGES.FORBIDDEN;
  if (error.code === "OPTIMISTIC_LOCK") return FULFILLMENT_ERROR_MESSAGES.OPTIMISTIC_LOCK;
  if (error.code === "LOCK_TIMEOUT") return FULFILLMENT_ERROR_MESSAGES.LOCK_TIMEOUT;
  return FULFILLMENT_ERROR_MESSAGES.generic;
}

/** Phiên / lệnh đã đổi ở nơi khác → tải lại phiên và lệnh. */
export function isStaleTransferPackError(error: unknown): boolean {
  // Phản hồi sai hợp đồng: BE có thể đã ghi thao tác → xem lại phiên thật
  if (error instanceof ZodError) return true;
  if (!(error instanceof ApiError)) return false;
  return (
    TRANSFER_PACK_STALE_ERROR_CODES.some((code) => code === error.code) ||
    isStaleFulfillmentError(error)
  );
}
