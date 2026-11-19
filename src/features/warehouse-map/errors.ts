/**
 * Lỗi BE của module 06 → câu tiếng Việt; mã lạ dùng `message` của BE. Lưu bản nháp hỏng giữa chừng
 * (`DraftSaveError`) thì báo bước hỏng kèm lý do — các bước trước đã lưu (BE không có giao dịch gộp).
 */

import { UI_LABELS, WAREHOUSE_MAP_ERROR_MESSAGES, WAREHOUSE_MAP_LIMITS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { DraftSaveError } from "./draft-save";
import { holdsCartonsDetailsDto } from "./schemas";

const HC = UI_LABELS.warehouseMap.holdsCartons;

/**
 * BR-04 (docs 06 §4.1 bước 9): ngưng kệ / bin / khu vực / kho còn thùng bị chặn — nêu thùng còn lại để Quản lý kho dời
 * đi trước. `details` sai dạng thì dùng câu chung, không làm hỏng màn hình.
 */
function holdsCartonsMessage(error: ApiError): string {
  const details = holdsCartonsDetailsDto.safeParse(error.details);
  if (!details.success || details.data.cartons.length === 0) return HC.fallback;
  const listed = details.data.cartons
    .slice(0, WAREHOUSE_MAP_LIMITS.listedInMessage)
    .map((carton) => HC.carton(carton.lpn, carton.locationCode));
  return HC.message(details.data.total, listed);
}

export function warehouseMapErrorMessage(error: unknown): string {
  if (error instanceof DraftSaveError)
    return `${UI_LABELS.warehouseMap.edit.saveFailed(error.step)} ${warehouseMapErrorMessage(error.cause)}`;
  if (error instanceof ApiError && error.code === "LOCATION_HOLDS_CARTONS")
    return holdsCartonsMessage(error);
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
    // BR-04 còn thùng là từ chối nghiệp vụ, không phải bản đồ cũ — tải lại không đổi được gì
    error.code !== "LOCATION_HOLDS_CARTONS" &&
    (error.status === 409 || error.status === 404 || error.code === "OPTIMISTIC_LOCK")
  );
}
