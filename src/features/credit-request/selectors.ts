/** Đề nghị cấp hạn mức — hàm thuần cho hiển thị. */

import { CREDIT_REQUEST_WARNING_LABELS } from "@/constants/credit-request";

import type { CreditRequestReview } from "./types";

/** Tỉ lệ đúng hạn dạng "85%"; null khi khách chưa trả đợt nào. */
export function onTimePercent(review: Pick<CreditRequestReview, "onTimeRatio">): string | null {
  if (review.onTimeRatio == null) return null;
  return `${Math.round(review.onTimeRatio * 100)}%`;
}

/** Nhãn cảnh báo; mã lạ giữ nguyên để không mất thông tin. */
export function warningLabel(code: string): string {
  return CREDIT_REQUEST_WARNING_LABELS[code] ?? code;
}

/** Kích cỡ tệp dễ đọc. */
export function fileSizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
