/**
 * Lỗi BE của module 06 → câu tiếng Việt. Lỗi hình học (BR-06/07/08) gắn về ô toạ độ / mặt lấy hàng;
 * mã lạ dùng `message` của BE. "Thêm kệ" gồm nhiều request: hỏng sau khi kệ đã tạo thì báo rõ kệ
 * vẫn còn trên bản đồ (`ShelfPartiallyCreatedError`) — không có giao dịch gộp ở BE.
 */

import { UI_LABELS, WAREHOUSE_MAP_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

const E = UI_LABELS.warehouseMap.editor;

export class ShelfPartiallyCreatedError extends Error {
  readonly cause: unknown;
  constructor(cause: unknown) {
    super(E.partialShelf);
    this.name = "ShelfPartiallyCreatedError";
    this.cause = cause;
  }
}

export function warehouseMapErrorMessage(error: unknown): string {
  if (error instanceof ShelfPartiallyCreatedError)
    return `${error.message} ${warehouseMapErrorMessage(error.cause)}`;
  if (error instanceof ApiError) return WAREHOUSE_MAP_ERROR_MESSAGES[error.code] ?? error.message;
  return error instanceof Error ? error.message : UI_LABELS.loadError.serverDescription;
}

/** Field form nhận lỗi theo mã BE — để lỗi hiện ngay tại ô gây ra (api-conventions §4.4). */
const FIELD_OF_CODE: Record<string, string> = {
  WAREHOUSE_PREFIX_ALREADY_EXISTS: "prefix",
  SHELF_CODE_ALREADY_EXISTS: "code",
  AREA_CODE_ALREADY_EXISTS: "code",
  ZONE_NAME_ALREADY_EXISTS: "name",
  LAYOUT_OUT_OF_BOUNDS: "x",
  LAYOUT_OVERLAP: "x",
  PICK_FACE_REQUIRED: "north",
};

export function fieldOfError(error: unknown): string | null {
  const root = error instanceof ShelfPartiallyCreatedError ? null : error;
  return root instanceof ApiError ? (FIELD_OF_CODE[root.code] ?? null) : null;
}

/** Bản đồ đã đổi trong lúc mình sửa → tải lại bố cục rồi mới báo lỗi. */
export function isStaleLayoutError(error: unknown): boolean {
  if (error instanceof ShelfPartiallyCreatedError) return true;
  return (
    error instanceof ApiError &&
    (error.status === 409 || error.status === 404 || error.code === "OPTIMISTIC_LOCK")
  );
}
