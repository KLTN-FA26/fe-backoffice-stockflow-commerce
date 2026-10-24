/**
 * Dòng lấy hàng — map lỗi BE → ô / banner (SCRUM-267/274; báo thiếu, phân bổ lại BE PR #147). Tách khỏi
 * `errors.ts` (giới hạn 200 dòng / file feature); câu chung của task dùng `fulfillmentErrorMessage`.
 */

import { FULFILLMENT_ERROR_MESSAGES, PICK_LINE_ERROR_MESSAGES } from "@/constants";
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

type LineRef = { locationCode: string; sku: string; allocatedQty: number };

export type ConfirmField = "locationCode" | "scannedCode" | "quantity";

/**
 * Lỗi xác nhận dòng (BE `PickList.confirm`) → ô hoặc banner. BE kiểm theo thứ tự vị trí → mã hàng → số
 * lượng và dừng ở lỗi đầu tiên, nên mỗi lần chỉ có một ô sai.
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
      return { field: "scannedCode", message: PL.itemMismatch(line.sku), stale: false };
    case "PICK_QUANTITY_EXCEEDS_ALLOCATION":
      return { field: "quantity", message: PL.quantityExceeds(line.allocatedQty), stale: false };
    case "PICK_QUANTITY_SHORT":
      return { field: "quantity", message: PL.quantityShort(line.allocatedQty), stale: false };
    case "RESERVATION_NOT_ACTIVE":
      return { message: PL.reservationNotActive, stale: false };
    case "PRODUCTION_HOLD_NOT_PICKABLE":
      return { message: PL.productionHold, stale: false };
    case "INVENTORY_POLICY_STOCK_CONFLICT":
      return { message: PL.policyConflict, stale: false };
    default:
      return commonLineError(error);
  }
}

export type ShortField = "locationCode" | "foundQuantity";

/** Lỗi báo thiếu (BE `PickList.reportShort`): sai vị trí → ô Vị trí; số tìm thấy ngoài khoảng (400) → ô SL. */
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
      return {
        field: "foundQuantity",
        message: PL.shortFoundRange(line.allocatedQty - 1),
        stale: false,
      };
    default:
      return commonLineError(error);
  }
}

/** Lỗi phân bổ lại (BE `reallocateShort`): không đủ hàng ở bin khác (409 INSUFFICIENT_STOCK) có câu riêng. */
export function reallocateError(error: unknown): string {
  if (!(error instanceof ApiError)) return FULFILLMENT_ERROR_MESSAGES.generic;
  if (error.code === "INSUFFICIENT_STOCK") return PL.insufficientStock;
  // BE reallocateShort không gọi requireAssigned: 404 = task / đơn / dòng không còn, không phải "không được gán"
  if (error.code === "NOT_FOUND") return PL.lineMissing;
  return commonLineError(error).message;
}
