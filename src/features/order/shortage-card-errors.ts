/**
 * Thẻ thiếu thùng — lỗi BE → câu Việt (BE `ErrorCode` SHORTAGE_*, docs 17 §4.14 bước 58). Theo `error.code`, không theo
 * message. Bước con bị từ chối (vd dời cửa sổ: `DELIVERY_BATCH_WINDOW_LOCKED`, đơn vừa đổi trạng thái) đi nguyên mã của
 * nó — BE giữ thẻ `ANSWERED`, Sale thấy lý do và xử lý lại.
 */

import { SHORTAGE_ERROR_MESSAGES, SHORTAGE_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { windowChangeErrorView } from "./delivery-window-errors";
import { ORDER_STALE_ERROR_CODES, commonErrorView, fallback } from "./errors";

import type { OrderErrorView } from "./errors";

type Step = "send" | "execute";

const WINDOW_CODES: readonly string[] = [
  "DELIVERY_BATCH_WINDOW_LOCKED",
  "DELIVERY_BATCH_NOT_FOUND",
];

/** Thẻ không còn như màn đang thấy (đã đổi / hết hiệu lực / không còn) → đóng hộp thoại, tải lại. */
export const SHORTAGE_STALE_CODES: readonly string[] = [
  ...ORDER_STALE_ERROR_CODES.filter((code) => code !== "CONFLICT"),
  "SHORTAGE_CARD_STATE_CONFLICT",
  "SHORTAGE_CARD_NOT_FOUND",
  "SHORTAGE_OPTION_NOT_AVAILABLE",
];

const isShortageCode = (code: string): code is keyof typeof SHORTAGE_ERROR_MESSAGES =>
  Object.hasOwn(SHORTAGE_ERROR_MESSAGES, code);

export function shortageErrorView(error: ApiError, step: Step): OrderErrorView {
  const title = SHORTAGE_LABELS.failedTitle[step];
  const traceId = error.traceId;
  if (isShortageCode(error.code)) {
    return { title, detail: SHORTAGE_ERROR_MESSAGES[error.code], traceId };
  }
  if (WINDOW_CODES.includes(error.code)) {
    return { ...windowChangeErrorView(error), title };
  }
  if (error.code === "VALIDATION_FAILED") {
    return { title, detail: "Kiểm tra lại các ô đã nhập (ghi chú tối đa 400 ký tự).", traceId };
  }
  const verb = step === "send" ? "gửi thẻ thiếu thùng" : "thực hiện lựa chọn của khách";
  return commonErrorView(error, title, verb) ?? fallback(error, title, verb);
}

export const shortageSendErrorView = (error: ApiError) => shortageErrorView(error, "send");
export const shortageExecuteErrorView = (error: ApiError) => shortageErrorView(error, "execute");

/** Gửi thẻ: đơn không còn gửi được (đã gỡ treo / hết thiếu / có thẻ mới) → đóng hộp thoại, tải lại. */
export const SHORTAGE_SEND_STALE_CODES: readonly string[] = [
  ...ORDER_STALE_ERROR_CODES.filter((code) => code !== "CONFLICT"),
  "SHORTAGE_CARD_NOT_SENDABLE",
];
