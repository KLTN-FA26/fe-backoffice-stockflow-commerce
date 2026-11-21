/**
 * Xác nhận cất — map lỗi BE → ô / banner (docs 05 §4.4, §6 Edge case). Thứ tự mã theo `PutawayService#putAway`.
 */

import { PUTAWAY_ERROR_MESSAGES as M } from "@/constants";
import { ApiError } from "@/lib/api/error";

export type PutawayField = "lpn" | "locationCode";

export interface PutawayConfirmError {
  /** Ô bị sai — lỗi hiện ngay dưới ô; vắng = banner trên thẻ. */
  field?: PutawayField;
  message: string;
  /** Nhiệm vụ đã đổi ở nơi khác (đã cất / không còn) → toast + tải lại, không giữ form. */
  stale: boolean;
  /** BE chỉ ra bin nhận được thùng (OVERFLOW bị từ chối) — màn đề nghị dùng bin đó. */
  alternative?: string;
}

/** Lỗi của ô bin — bin không tồn tại / không phải bin / kho khác / khoá / không lọt / hết chỗ (BR-03, BR-04, BR-09). */
const LOCATION_CODES = [
  "LOCATION_NOT_FOUND",
  "PUTAWAY_TARGET_NOT_BIN",
  "MOVE_ACROSS_WAREHOUSES",
  "LOCATION_NOT_USABLE",
  "CARTON_DOES_NOT_FIT_BIN",
  "LOCATION_CAPACITY_EXCEEDED",
] as const;
type LocationCode = (typeof LOCATION_CODES)[number];
const isLocationCode = (code: string): code is LocationCode =>
  LOCATION_CODES.some((known) => known === code);

/** `details.locationCode` khi là chuỗi không rỗng — dữ liệu mạng nên không tin kiểu. */
function suggestedBin(error: ApiError): string | undefined {
  const value = error.details?.locationCode;
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/**
 * `expectedLpn`: LPN của nhiệm vụ — câu "sai thùng" nêu đúng thùng phải quét (BE không trả trong details).
 */
export function putawayConfirmError(
  error: unknown,
  expectedLpn: string | null | undefined,
): PutawayConfirmError {
  if (!(error instanceof ApiError)) return { message: M.generic, stale: false };
  const code = error.code;
  if (code === "PUTAWAY_TASK_NOT_FOUND" || code === "PUTAWAY_TASK_DONE") {
    return { message: M[code], stale: true };
  }
  if (code === "PUTAWAY_LPN_MISMATCH") {
    return { field: "lpn", message: M.PUTAWAY_LPN_MISMATCH(expectedLpn ?? "—"), stale: false };
  }
  if (isLocationCode(code)) return { field: "locationCode", message: M[code], stale: false };
  if (code === "PUTAWAY_OVERFLOW_NOT_ALLOWED") {
    // BR-13 (docs 05 §6): OVERFLOW chỉ khi không bin nào vừa — BE nêu bin tốt nhất trong details.locationCode
    const alternative = suggestedBin(error);
    return {
      field: "locationCode",
      message: alternative
        ? `${M.PUTAWAY_OVERFLOW_NOT_ALLOWED} ${M.PUTAWAY_OVERFLOW_ALTERNATIVE(alternative)}`
        : M.PUTAWAY_OVERFLOW_NOT_ALLOWED,
      stale: false,
      ...(alternative ? { alternative } : {}),
    };
  }
  if (code === "VALIDATION_FAILED") {
    const field = (["lpn", "locationCode"] as const).find((f) => error.fieldErrors?.[f]);
    // Lỗi định dạng của một ô; không ô nào → nhiệm vụ đã huỷ / task lẻ cũ (BE PutawayService)
    return field
      ? { field, message: error.fieldErrors?.[field] ?? M.generic, stale: false }
      : { message: M.notActionable, stale: true };
  }
  if (
    code === "OUT_OF_DATA_SCOPE" ||
    code === "FORBIDDEN" ||
    code === "IDEMPOTENT_REQUEST_IN_PROGRESS" ||
    code === "NETWORK_ERROR"
  ) {
    return { message: M[code], stale: false };
  }
  return { message: error.message || M.generic, stale: false };
}
