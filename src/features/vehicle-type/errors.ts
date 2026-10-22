/**
 * Lỗi BE của danh mục loại xe (PR #153) → câu tiếng Việt. Chỉ rẽ nhánh theo `errorCode` ổn định,
 * không lộ message tiếng Anh. `VALIDATION_FAILED` nêu tên ô kèm câu BE đã dịch cho ô đó (BE trả theo locale).
 */

import { VEHICLE_TYPE_ERROR_MESSAGES as MESSAGES, VEHICLE_TYPE_FIELD_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

type KnownCode = Exclude<
  keyof typeof MESSAGES,
  "generic" | "VALIDATION_CODE_IMMUTABLE" | "VALIDATION_KIND_IMMUTABLE"
>;

const isKnownCode = (code: string): code is KnownCode =>
  code !== "generic" &&
  code !== "VALIDATION_CODE_IMMUTABLE" &&
  code !== "VALIDATION_KIND_IMMUTABLE" &&
  Object.hasOwn(MESSAGES, code);

/** Mã lỗi trường của BE (`fieldErrors[].code`) nói trường này không đổi được. */
const IMMUTABLE_FIELD_CODES: Readonly<Record<string, string>> = {
  code: "VEHICLE_TYPE_CODE_IMMUTABLE",
  kind: "VEHICLE_TYPE_KIND_IMMUTABLE",
};

export interface VehicleTypeErrorContext {
  /** Đang sửa một loại xe mặc định: mã và loại của nó không đổi được. */
  updatingPreset?: boolean;
}

/**
 * `code` / `kind` chỉ được nói "không đổi được" khi đúng là vậy: BE nêu mã lỗi trường `*_IMMUTABLE`, hoặc
 * đang sửa loại xe mặc định. Còn lại (vd mã sai định dạng khi thêm mới) hiện đúng câu của BE cho ô đó.
 */
function immutableMessage(
  field: string | undefined,
  code: string | undefined,
  context: VehicleTypeErrorContext,
): string | null {
  if (field !== "code" && field !== "kind") return null;
  if (code !== IMMUTABLE_FIELD_CODES[field] && !context.updatingPreset) return null;
  return field === "code" ? MESSAGES.VALIDATION_CODE_IMMUTABLE : MESSAGES.VALIDATION_KIND_IMMUTABLE;
}

export function vehicleTypeErrorMessage(
  error: unknown,
  context: VehicleTypeErrorContext = {},
): string {
  if (!(error instanceof ApiError)) return MESSAGES.generic;
  if (error.code === "VALIDATION_FAILED") {
    const [field] = Object.keys(error.fieldErrors ?? {});
    const immutable = immutableMessage(
      field,
      field ? error.fieldCodes?.[field] : undefined,
      context,
    );
    if (immutable) return immutable;
    const label = field
      ? Object.hasOwn(VEHICLE_TYPE_FIELD_LABELS, field)
        ? VEHICLE_TYPE_FIELD_LABELS[field]
        : field
      : "";
    const detail = field ? error.fieldErrors?.[field] : undefined;
    if (label && detail) return `${label}: ${detail}`;
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
