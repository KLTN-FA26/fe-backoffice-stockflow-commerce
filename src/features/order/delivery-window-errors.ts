/**
 * Dời cửa sổ giao — lỗi BE → lý do hiển thị (BE `DeliveryBatchService#changeWindow` / `#check`, docs 17 BR-28).
 *
 * Branch theo `error.code`. BE dùng `VALIDATION_FAILED` cho nhiều điều kiện (quá khứ, thứ tự đợt, thiếu / sai bằng chứng,
 * ghi chú) nên câu Việt liệt kê các điều kiện cần kiểm; `CONFLICT` có hai nghĩa — đơn đã huỷ / đóng / hoàn tất (`check`) hoặc
 * tệp bằng chứng đang được gắn ở request khác (`StagedUploads#accept`) — câu nêu cả hai. Lỗi "dữ liệu cũ" đóng hộp thoại + tải lại; còn lại giữ hộp thoại.
 */

import { WINDOW_CHANGE_LABELS as L } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { DirectUploadError } from "@/lib/api/direct-upload";

import { commonErrorView, fallback } from "./errors";

import type { OrderErrorView, ServerFieldMap } from "./errors";

/** Dữ liệu trên màn đã cũ: đợt không còn thuộc đơn, đã khoá vì bàn giao, đơn đã đóng, đơn không còn. */
export const WINDOW_CHANGE_STALE_CODES: readonly string[] = [
  "DELIVERY_BATCH_WINDOW_LOCKED",
  "DELIVERY_BATCH_NOT_FOUND",
  "CONFLICT",
  "NOT_FOUND",
];

const VERB = "dời cửa sổ giao";

export function windowChangeErrorView(error: ApiError): OrderErrorView {
  const title = L.failedTitle;
  const traceId = error.traceId;
  switch (error.code) {
    case "DELIVERY_BATCH_WINDOW_LOCKED":
      return { title, detail: L.locked, rule: L.lockedRule, traceId };
    case "DELIVERY_BATCH_NOT_FOUND":
      return { title, detail: L.batchNotFound, traceId };
    case "CONFLICT":
      return { title, detail: L.orderClosed, traceId };
    case "VALIDATION_FAILED":
      return { title, detail: L.validation, rule: L.validationRule, traceId };
    // 415 khi gắn tệp: byte không đúng loại đã khai báo (BE `StagedUploads#accept`)
    case "UNSUPPORTED_MEDIA_TYPE":
      return { title, detail: L.evidenceTypeMismatch, traceId };
    default:
      return commonErrorView(error, title, VERB) ?? fallback(error, title, VERB);
  }
}

/** BE `WindowChangeRequest` (bean validation: @NotNull windowStart / windowEnd / reasonCode, @NotBlank note) → ô form. */
export const WINDOW_CHANGE_FIELD_ERRORS = {
  windowStart: { field: "windowStart", message: L.startRequired },
  windowEnd: { field: "windowEnd", message: L.endRequired },
  reasonCode: { field: "reasonCode", message: L.reasonRequired },
  note: { field: "note", message: L.noteRequired },
} as const satisfies ServerFieldMap<"windowStart" | "windowEnd" | "reasonCode" | "note">;

/**
 * Lỗi của việc tải tệp bằng chứng (xin đường tải ở BE + PUT lên kho) → câu tiếng Việt. Không bao giờ hiện message tiếng Anh
 * của BE / kho. Pure — nhận `unknown` vì lỗi đến từ `declare` (ApiError), PUT (DirectUploadError) hoặc parse slot (ZodError).
 */
export function evidenceUploadErrorMessage(error: unknown): string {
  const F = L.file;
  if (error instanceof DirectUploadError) {
    return error.kind === "network" ? F.network : F.storageRefused;
  }
  if (!(error instanceof ApiError)) return F.unknown;
  switch (error.code) {
    case "UNSUPPORTED_MEDIA_TYPE":
      return F.unsupportedType;
    case "PAYLOAD_TOO_LARGE":
      return F.payloadTooLarge;
    case "VALIDATION_FAILED":
      return F.invalidDeclaration;
    case "RATE_LIMITED":
      return F.rateLimited;
    case "NOT_FOUND":
    case "CONFLICT":
    case "DELIVERY_BATCH_NOT_FOUND":
      return F.batchGone;
    case "FORBIDDEN":
    case "OUT_OF_DATA_SCOPE":
      return F.forbidden;
    case "NETWORK_ERROR":
      return F.network;
    case "STORAGE_ERROR":
      return F.storageUnavailable;
    default:
      return error.status >= 500 ? F.storageUnavailable : F.unknown;
  }
}
