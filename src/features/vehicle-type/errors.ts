/**
 * Lỗi BE của danh mục loại xe (PR #153) → câu tiếng Việt. Chỉ rẽ nhánh theo `errorCode` ổn định,
 * không lộ message tiếng Anh. `VALIDATION_FAILED` chỉ nêu tên ô cần sửa (message BE là tiếng Anh).
 */

import { VEHICLE_TYPE_ERROR_MESSAGES as MESSAGES, VEHICLE_TYPE_FIELD_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

type KnownCode = Exclude<keyof typeof MESSAGES, "generic" | "VALIDATION_CODE_IMMUTABLE">;

const isKnownCode = (code: string): code is KnownCode =>
  code !== "generic" && code !== "VALIDATION_CODE_IMMUTABLE" && Object.hasOwn(MESSAGES, code);

export function vehicleTypeErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return MESSAGES.generic;
  if (error.code === "VALIDATION_FAILED") {
    const [field] = Object.keys(error.fieldErrors ?? {});
    // PUT với mã khác mã hiện tại: BE trả 400 trên trường `code`
    if (field === "code") return MESSAGES.VALIDATION_CODE_IMMUTABLE;
    const label = field
      ? Object.hasOwn(VEHICLE_TYPE_FIELD_LABELS, field)
        ? VEHICLE_TYPE_FIELD_LABELS[field]
        : field
      : "";
    return label ? `${MESSAGES.VALIDATION_FAILED} (${label})` : MESSAGES.VALIDATION_FAILED;
  }
  if (isKnownCode(error.code)) return MESSAGES[error.code];
  if (error.status === 403) return MESSAGES.FORBIDDEN;
  return MESSAGES.generic;
}

/**
 * Dữ liệu trên màn đã cũ (người khác sửa, hoặc loại xe không còn) → mutation tải lại danh sách và
 * chi tiết, để câu "Đã tải lại" là thật.
 */
const STALE_CODES: ReadonlySet<string> = new Set(["OPTIMISTIC_LOCK", "VEHICLE_TYPE_NOT_FOUND"]);

export function isStaleVehicleTypeError(error: unknown): boolean {
  return error instanceof ApiError && STALE_CODES.has(error.code);
}
