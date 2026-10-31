/**
 * Lỗi BE của module 06 → câu tiếng Việt; mã lạ dùng `message` của BE. Lưu bản nháp hỏng giữa chừng
 * (`DraftSaveError`) thì báo bước hỏng kèm lý do — các bước trước đã lưu (BE không có giao dịch gộp).
 */

import { UI_LABELS, WAREHOUSE_MAP_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { DraftSaveError } from "./draft-save";

export function warehouseMapErrorMessage(error: unknown): string {
  if (error instanceof DraftSaveError)
    return `${UI_LABELS.warehouseMap.edit.saveFailed(error.step)} ${warehouseMapErrorMessage(error.cause)}`;
  if (error instanceof ApiError) return WAREHOUSE_MAP_ERROR_MESSAGES[error.code] ?? error.message;
  return error instanceof Error ? error.message : UI_LABELS.loadError.serverDescription;
}

/** Field form nhận lỗi theo mã BE — để lỗi hiện ngay tại ô gây ra (api-conventions §4.4). */
const FIELD_OF_CODE: Record<string, string> = {
  WAREHOUSE_PREFIX_ALREADY_EXISTS: "prefix",
};

export function fieldOfError(error: unknown): string | null {
  return error instanceof ApiError ? (FIELD_OF_CODE[error.code] ?? null) : null;
}

/** Bản đồ đã đổi trong lúc mình sửa → tải lại bố cục rồi mới báo lỗi. */
export function isStaleLayoutError(error: unknown): boolean {
  if (error instanceof DraftSaveError) return isStaleLayoutError(error.cause);
  return (
    error instanceof ApiError &&
    (error.status === 409 || error.status === 404 || error.code === "OPTIMISTIC_LOCK")
  );
}
