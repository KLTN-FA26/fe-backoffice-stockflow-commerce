/** Ước tính xếp xe — dẫn xuất thuần để hiển thị (không side effect, không gọi API). */

import {
  LOAD_ESTIMATE_MISSING_FIELD_LABELS,
  LOAD_ESTIMATE_UNPLACED_REASON_LABELS,
  LOAD_ESTIMATE_WARNING_LABELS,
} from "@/constants";

import { summarizeLayouts } from "../selectors";

import type { LayoutSummary } from "../selectors";
import type {
  EstimateUnplaced,
  EstimateWarning,
  KitWarning,
  LoadEstimate,
} from "../estimate-types";

/** Lý do BE khi hết thời gian tính mà xe còn chỗ (`UnplacedReason.SEARCH_CUT_OFF`). */
export const SEARCH_CUT_OFF = "SEARCH_CUT_OFF";

export function totalUnplaced(unplaced: readonly Pick<EstimateUnplaced, "quantity">[]): number {
  return unplaced.reduce((sum, line) => sum + line.quantity, 0);
}

/** Số liệu tổng hợp của ước tính: xe, kiện, hiệu suất thể tích, khối lượng, kiện chưa xếp. */
export function summarizeEstimate(
  estimate: Pick<LoadEstimate, "vehicles" | "unplaced">,
): LayoutSummary {
  return summarizeLayouts(estimate.vehicles, totalUnplaced(estimate.unplaced));
}

/**
 * "Dừng do hết thời gian tính": BE đặt `meta.budgetExhausted`, hoặc có kiện bị bỏ vì SEARCH_CUT_OFF. Kết quả vẫn là
 * phương án tốt nhất tìm được trong thời gian cho phép (LP2-10) — không phải lỗi.
 */
export function isBudgetExhausted(estimate: Pick<LoadEstimate, "meta" | "unplaced">): boolean {
  return (
    estimate.meta.budgetExhausted ||
    estimate.unplaced.some((line) => line.reason === SEARCH_CUT_OFF)
  );
}

/** Trường thiếu → "chiều dài, khối lượng"; mã lạ giữ nguyên. */
export function missingFieldsText(fields: readonly string[]): string {
  return fields.map((field) => LOAD_ESTIMATE_MISSING_FIELD_LABELS[field] ?? field).join(", ");
}

export function unplacedReasonText(reason: string): string {
  return LOAD_ESTIMATE_UNPLACED_REASON_LABELS[reason] ?? reason;
}

/** Câu tiếng Việt của một cảnh báo theo mã BE (BE gửi câu tiếng Anh); mã lạ hiện chính mã. */
export function warningText(
  warning: Pick<EstimateWarning, "code"> | Pick<KitWarning, "type">,
): string {
  const code = "code" in warning ? warning.code : warning.type;
  return LOAD_ESTIMATE_WARNING_LABELS[code] ?? code;
}
