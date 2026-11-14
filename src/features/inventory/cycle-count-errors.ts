/**
 * Kiểm kê — map lỗi API sang câu hiển thị. Branch theo `error.code` (= `errorCode` của BE), không theo
 * `error.message` (tiếng Anh, có thể đổi); mã lạ rơi về `inventoryErrorView` theo HTTP status. Câu của người đếm
 * trên phiếu kiểm mù luôn trung tính — không nói sổ sách ghi thùng ở đâu hay đang ở trạng thái nào (docs 20 BR-07).
 */

import { CYCLE_COUNT_ERROR_MESSAGES } from "@/constants/cycle-count";

import { ApiError } from "@/lib/api/error";

import { inventoryErrorView } from "./errors";

const M = CYCLE_COUNT_ERROR_MESSAGES;

export interface CycleCountActionError {
  detail: string;
  traceId?: string;
}

function messageOf(code: string): string | null {
  switch (code) {
    case "CYCLE_COUNT_NOT_OPEN":
      return M.notOpen;
    case "CYCLE_COUNT_NOT_ASSIGNEE":
      return M.notAssignee;
    case "CYCLE_COUNT_LINE_COUNTED_BY_OTHER":
      return M.countedByOther;
    case "CYCLE_COUNT_LINE_NOT_COUNTED":
      return M.notCounted;
    case "CYCLE_COUNT_SLOT_BUSY":
      return M.slotBusy;
    case "CYCLE_COUNT_STALE":
      return M.stale;
    case "CYCLE_COUNT_TOO_LARGE":
      return M.tooLarge;
    case "CYCLE_COUNT_EMPTY_SCOPE":
      return M.emptyScope;
    case "STOCK_PACKAGE_WRONG_LOCATION":
      return M.wrongLocation;
    case "STOCK_PACKAGE_NOT_FOUND":
      return M.cartonNotFound;
    // ErrorCode.CONFLICT: a carton that cannot be counted found / added (status or warehouse), answered with a
    // neutral message to a blind counter.
    case "CONFLICT":
      return M.cannotCount;
    case "NOT_FOUND":
      return M.notFound;
    case "OUT_OF_DATA_SCOPE":
      return M.outOfScope;
    case "FORBIDDEN":
      return M.forbidden;
    case "VALIDATION_FAILED":
      return M.validation;
    case "OPTIMISTIC_LOCK":
      return M.conflict;
    case "NETWORK_ERROR":
      return M.network;
    default:
      return null;
  }
}

export function cycleCountActionError(error: unknown): CycleCountActionError {
  if (error instanceof ApiError) {
    const detail = messageOf(error.code);
    if (detail) return { detail, traceId: error.traceId };
  }
  const view = inventoryErrorView(error);
  return { detail: view.detail, traceId: view.traceId };
}

// The screen is behind the server: the sheet was closed, a line was counted elsewhere or stock moved since the
// count — reload the sheet so the lines and the actions are computed from what the server holds now.
const STALE_CYCLE_COUNT_CODES: readonly string[] = [
  "CYCLE_COUNT_NOT_OPEN",
  "CYCLE_COUNT_STALE",
  "CYCLE_COUNT_LINE_NOT_COUNTED",
  "OPTIMISTIC_LOCK",
];

export function isStaleCycleCountError(error: unknown): boolean {
  return error instanceof ApiError && STALE_CYCLE_COUNT_CODES.includes(error.code);
}
