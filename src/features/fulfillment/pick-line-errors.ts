/**
 * Dòng lấy hàng — map lỗi BE → ô / banner (docs 07 §4.2, §4.4, §4.5; báo thiếu, phân bổ lại, cất lại). Tách khỏi
 * `errors.ts` (giới hạn 200 dòng / file feature); câu chung của task dùng `fulfillmentErrorMessage`.
 */

import {
  FULFILLMENT_ERROR_MESSAGES,
  FULFILLMENT_FIELD_MESSAGES,
  PICK_LINE_ERROR_MESSAGES,
  PUT_BACK_ERROR_MESSAGES,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import { STATE_CONFLICT_CODE, fulfillmentErrorMessage } from "./errors";

const PL = PICK_LINE_ERROR_MESSAGES;

export interface LineError<F extends string> {
  /** Ô bị sai — lỗi hiện ngay dưới ô; vắng = banner trên form. */
  field?: F;
  message: string;
  /** Dòng / task đã đổi ở nơi khác → tải lại, không giữ form. */
  stale: boolean;
}

/** Mã chung của mọi thao tác ghi trên dòng; mã riêng của từng thao tác xét trước. */
function commonLineError(error: ApiError): LineError<never> {
  switch (error.code) {
    case "PICK_LINE_NOT_OPEN":
      return { message: PL.lineNotOpen, stale: true };
    case STATE_CONFLICT_CODE:
      return { message: PL.taskState, stale: true };
    case "NOT_FOUND":
      return { message: PL.notAssignee, stale: true };
    case "IDEMPOTENT_REQUEST_IN_PROGRESS":
      return { message: PL.inProgress, stale: false };
    case "NETWORK_ERROR":
      return { message: PL.network, stale: false };
    default:
      return { message: fulfillmentErrorMessage(error, "pick"), stale: false };
  }
}

/**
 * Dòng đang thao tác — `locationCode` / `lpn` là giá trị đúng của dòng. BE chỉ nêu chúng trong câu tiếng Anh của
 * lỗi (`PICK_LOCATION_MISMATCH` "picked from <bin>", `PICK_ITEM_MISMATCH` "picks carton <LPN>"), không có field
 * chi tiết — nên câu tiếng Việt lấy đúng giá trị từ chính dòng (cùng nguồn BE dùng) thay vì tách chữ từ message.
 */
type LineRef = { locationCode: string; lpn?: string | null; sku: string };

export type ConfirmField = "locationCode" | "lpn";

/**
 * Lỗi xác nhận dòng (BE `PickList.confirm`, docs 07 §4.2 bước 5, BR-10) → ô hoặc banner. BE kiểm theo thứ tự vị
 * trí → LPN và dừng ở lỗi đầu tiên, nên mỗi lần chỉ có một ô sai: sai vị trí nêu bin đúng của dòng; SKU / mã vạch /
 * LPN khác (kể cả LPN của đơn khác) nêu LPN đúng của dòng.
 */
export function confirmLineError(error: unknown, line: LineRef): LineError<ConfirmField> {
  if (!(error instanceof ApiError))
    return { message: FULFILLMENT_ERROR_MESSAGES.generic, stale: false };
  switch (error.code) {
    case "PICK_LOCATION_MISMATCH":
      return {
        field: "locationCode",
        message: PL.locationMismatch(line.locationCode),
        stale: false,
      };
    case "PICK_ITEM_MISMATCH":
      return { field: "lpn", message: PL.itemMismatch(line.lpn), stale: false };
    case "RESERVATION_NOT_ACTIVE":
      return { message: PL.reservationNotActive, stale: false };
    case "PRODUCTION_HOLD_NOT_PICKABLE":
      return { message: PL.productionHold, stale: false };
    case "INVENTORY_POLICY_STOCK_CONFLICT":
      return { message: PL.policyConflict, stale: false };
    case "PICK_HOLD_NOT_IN_CARTON":
      return { message: PL.holdNotInCarton, stale: false };
    default:
      return commonLineError(error);
  }
}

export type ShortField = "locationCode" | "reason";

/**
 * Lỗi báo thiếu (BE `PickList.reportShort`): sai vị trí → ô Vị trí (nêu bin đúng của dòng); thiếu lý do / vị
 * trí (400) → ô tương ứng theo `fieldErrors` của BE.
 */
export function shortPickError(error: unknown, line: LineRef): LineError<ShortField> {
  if (!(error instanceof ApiError))
    return { message: FULFILLMENT_ERROR_MESSAGES.generic, stale: false };
  switch (error.code) {
    case "PICK_LOCATION_MISMATCH":
      return {
        field: "locationCode",
        message: PL.locationMismatch(line.locationCode),
        stale: false,
      };
    case "VALIDATION_FAILED":
      if (error.fieldErrors && "reason" in error.fieldErrors) {
        return {
          field: "reason",
          message: FULFILLMENT_FIELD_MESSAGES.shortReasonRequired,
          stale: false,
        };
      }
      return commonLineError(error);
    default:
      return commonLineError(error);
  }
}

/** Lỗi phân bổ lại (BE `reallocateShort`): không đủ thùng ở nơi khác (409 INSUFFICIENT_STOCK) có câu riêng. */
export function reallocateError(error: unknown): string {
  if (!(error instanceof ApiError)) return FULFILLMENT_ERROR_MESSAGES.generic;
  if (error.code === "INSUFFICIENT_STOCK") return PL.insufficientStock;
  // BE reallocateShort không gọi requireAssigned: 404 = task / đơn / dòng không còn, không phải "không được gán"
  if (error.code === "NOT_FOUND") return PL.lineMissing;
  if (error.code === "PICK_HOLD_NOT_IN_CARTON") return PL.holdNotInCarton;
  return commonLineError(error).message;
}

export type PutBackField = "locationCode" | "lpn";

/**
 * Lỗi cất lại thùng (BE `PickList.putBack`, docs 07 §4.5 bước 14): bin không hợp lệ / không vừa → ô Vị trí; sai LPN →
 * ô LPN (nêu LPN đúng); dòng hết chờ → tải lại. `quarantine`: thùng hư hỏng phải vào khu cách ly, không về bin.
 */
export function putBackError(
  error: unknown,
  row: { lpn?: string | null; quarantine?: boolean | null } = {},
): LineError<PutBackField> {
  const M = PUT_BACK_ERROR_MESSAGES;
  if (!(error instanceof ApiError))
    return { message: FULFILLMENT_ERROR_MESSAGES.generic, stale: false };
  switch (error.code) {
    case "PUT_BACK_LOCATION_INVALID":
      return {
        field: "locationCode",
        message: row.quarantine ? M.quarantineLocationInvalid : M.locationInvalid,
        stale: false,
      };
    case "CARTON_DOES_NOT_FIT_BIN":
      return { field: "locationCode", message: M.doesNotFit, stale: false };
    case "PICK_ITEM_MISMATCH":
      return { field: "lpn", message: M.itemMismatch(row.lpn), stale: false };
    case "STOCK_PACKAGE_TAKEN_WHOLE":
      return { message: M.takenWhole, stale: false };
    case "PUT_BACK_NOT_REQUIRED":
      return { message: M.notRequired, stale: true };
    case "NOT_FOUND":
      return { message: M.notFound, stale: true };
    case "OUT_OF_DATA_SCOPE":
      return { message: M.outOfScope, stale: false };
    case "NETWORK_ERROR":
      return { message: M.network, stale: false };
    default:
      return { message: commonLineError(error).message, stale: false };
  }
}
