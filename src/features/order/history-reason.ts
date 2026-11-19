/**
 * Lý do của một bước đổi trạng thái trong lịch sử đơn → câu tiếng Việt. PURE.
 *
 * BE `Order#transitionTo` ghi `CODE` hoặc `CODE: ghi chú` (`Order#withNote`); riêng yêu cầu trả hàng ghi
 * `RETURN_REQUESTED <số RMA>` (cách bằng dấu cách) và gỡ giữ ghi `HOLD_RESOLVED_<lý do giữ>[: ghi chú]`. Mã tra theo thứ
 * tự: bảng mã lịch sử (`ORDER_HISTORY_REASON_LABELS`), lý do giữ (`HoldReason` — bước vào ON_HOLD), lý do giao thất bại
 * (`DeliveryFailureReason` — bước vào DELIVERY_FAILED). Không khớp dạng mã hoặc mã lạ → giữ nguyên văn (ghi chú tự do,
 * hoặc mã BE mới), không bỏ trống. Huỷ đơn / đóng phần còn lại có bộ đọc riêng (`selectors.ts`).
 */

import {
  ORDER_DELIVERY_FAILURE_LABELS,
  ORDER_HISTORY_LABELS,
  ORDER_HISTORY_REASON_LABELS,
  ORDER_HOLD_REASON_LABELS,
} from "@/constants";

const CODED_REASON = /^([A-Z][A-Z0-9_]*)(?:: ([\s\S]*))?$/;
const RETURN_REQUESTED_WITH_RMA = /^RETURN_REQUESTED (\S+)$/;
const HOLD_RESOLVED = "HOLD_RESOLVED_";

function lookup(table: Readonly<Record<string, string>>, code: string): string | null {
  return Object.hasOwn(table, code) ? (table[code] ?? null) : null;
}

/** Nhãn của một mã lý do; null khi FE chưa biết mã. */
export function historyReasonCodeLabel(code: string): string | null {
  if (code.startsWith(HOLD_RESOLVED)) {
    const hold = lookup(ORDER_HOLD_REASON_LABELS, code.slice(HOLD_RESOLVED.length));
    return hold
      ? ORDER_HISTORY_LABELS.holdResolvedWithReason(hold)
      : ORDER_HISTORY_LABELS.holdResolved;
  }
  return (
    lookup(ORDER_HISTORY_REASON_LABELS, code) ??
    lookup(ORDER_HOLD_REASON_LABELS, code) ??
    lookup(ORDER_DELIVERY_FAILURE_LABELS, code)
  );
}

const withNote = (label: string, note: string | null | undefined) => {
  const trimmed = note?.trim();
  return trimmed ? `${label} — ${trimmed}` : label;
};

/** "CUSTOMER_ABSENT: Gọi 3 lần" → "Khách vắng mặt — Gọi 3 lần"; "RETURN_REQUESTED RMA-1" → "Khách yêu cầu trả hàng — RMA-1". */
export function formatHistoryReason(reason: string): string {
  const text = reason.trim();
  const rma = RETURN_REQUESTED_WITH_RMA.exec(text);
  if (rma) {
    const label = historyReasonCodeLabel("RETURN_REQUESTED");
    if (label) return withNote(label, rma[1]);
  }
  const match = CODED_REASON.exec(text);
  const label = match?.[1] ? historyReasonCodeLabel(match[1]) : null;
  return label ? withNote(label, match?.[2]) : text;
}
