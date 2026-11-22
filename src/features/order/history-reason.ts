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
const SHIPMENT_RETURNED = "RETURNED";
const SHIPMENT_RETURNED_WITH_REASON = "RETURNED_";
/** Ghi chú cũ BE từng ghi cho phần đóng khi lô hoàn về ("Returned shipment <UUID>") — không hiện mã lô cho người dùng. */
const LEGACY_RETURNED_CLOSURE_NOTE = /^Returned shipment [0-9a-f-]{36}$/i;

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
  const known =
    lookup(ORDER_HISTORY_REASON_LABELS, code) ??
    lookup(ORDER_HOLD_REASON_LABELS, code) ??
    lookup(ORDER_DELIVERY_FAILURE_LABELS, code);
  if (known) return known;
  // Lô giao hoàn về kho (BE `Order#recordShipmentReturned`): `RETURNED` hoặc `RETURNED_<lý do giao thất bại>`
  if (code === SHIPMENT_RETURNED) return ORDER_HISTORY_LABELS.shipmentReturned;
  if (code.startsWith(SHIPMENT_RETURNED_WITH_REASON)) {
    const failure = lookup(
      ORDER_DELIVERY_FAILURE_LABELS,
      code.slice(SHIPMENT_RETURNED_WITH_REASON.length),
    );
    if (failure) return ORDER_HISTORY_LABELS.shipmentReturnedWithReason(failure);
  }
  return null;
}

/** Ghi chú của mục "Đóng phần còn lại": ghi chú cũ tiếng Anh kèm UUID của lô hoàn → câu tiếng Việt; còn lại giữ nguyên. */
export function formatClosureNote(note: string): string {
  return LEGACY_RETURNED_CLOSURE_NOTE.test(note.trim())
    ? ORDER_HISTORY_LABELS.shipmentReturnedClosureNote
    : note;
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
