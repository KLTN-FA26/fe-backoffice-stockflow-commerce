/**
 * Lọc phía FE của hàng đợi yêu cầu trả hàng (data-table-mode-a §4.1) — hàm thuần. BE `GET /returns` nhận `search`
 * (số RMA / mã đơn) và `status`, KHÔNG nhận lý do / nguồn → hai lọc này chỉ xét trang đang xem.
 */

import type { ReturnRow } from "./types";

/** Khoá URL của lọc header cột. */
export const RETURN_FILTER_KEYS = ["rtReason", "rtChannel"] as const;
export type ReturnFilterKey = (typeof RETURN_FILTER_KEYS)[number];

/** Dòng khớp lọc lý do + nguồn (so theo mã BE); ô trống = không lọc. */
export function matchesReturnRow(
  row: ReturnRow,
  filters: Record<ReturnFilterKey, string>,
): boolean {
  return (
    (!filters.rtReason || row.reasonCode === filters.rtReason) &&
    (!filters.rtChannel || row.channel === filters.rtChannel)
  );
}
