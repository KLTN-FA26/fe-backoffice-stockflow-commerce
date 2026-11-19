/** Selector thuần của lịch sản xuất (kltn-docs 17 §4.12) — không side effect. */

import type { DelayAlertType } from "@/constants";
import type { DelayFlag, ScheduledProductionOrder, ShortDeliveryBatch } from "./schedule-schemas";

const DAY_MS = 86_400_000;
const utc = (iso: string) =>
  Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/** Số ngày từ `today` tới `date` ("yyyy-MM-dd"); âm = đã quá. */
export const daysUntil = (date: string, today: string): number =>
  Math.round((utc(date) - utc(today)) / DAY_MS);

/** Docs 17 §4.12 bước 47: xếp theo ngày cần hàng, cùng ngày thì theo mã. */
export function byNeedByDate(
  entries: readonly ScheduledProductionOrder[],
): ScheduledProductionOrder[] {
  return [...entries].sort(
    (a, b) => a.needByDate.localeCompare(b.needByDate) || a.code.localeCompare(b.code),
  );
}

/** Đợt còn thiếu: cửa sổ giao sớm nhất trước (đợt sắp tới cần lập Đơn sản xuất trước). */
export function byWindowStart(batches: readonly ShortDeliveryBatch[]): ShortDeliveryBatch[] {
  return [...batches].sort(
    (a, b) => (a.windowStart ?? "9999").localeCompare(b.windowStart ?? "9999") || a.seq - b.seq,
  );
}

/** Ngày dự kiến muộn hơn ngày cần hàng — chính điều kiện của AT_RISK (docs 17 §4.12 bước 48). */
export const expectedAfterNeedBy = (
  entry: Pick<ScheduledProductionOrder, "needByDate" | "expectedCompletionDate">,
): boolean =>
  Boolean(entry.expectedCompletionDate && entry.expectedCompletionDate > entry.needByDate);

/**
 * Thứ tự hiện cờ: trễ thật trước nguy cơ (danger trước warning — thứ tự tone của design system), cùng loại thì mở
 * sớm trước.
 */
const FLAG_ORDER: Record<DelayAlertType, number> = {
  PRODUCTION_LATE: 0,
  DELIVERY_LATE: 1,
  AT_RISK: 2,
  PO_NEEDED: 3,
};

export function sortFlags(flags: readonly DelayFlag[]): DelayFlag[] {
  return [...flags].sort(
    (a, b) => FLAG_ORDER[a.type] - FLAG_ORDER[b.type] || a.openedAt.localeCompare(b.openedAt),
  );
}
