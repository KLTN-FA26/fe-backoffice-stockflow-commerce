"use client";

import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { CANCELLATION_REQUEST_STATUSES } from "@/constants";
import { useColumnTextFilters } from "@/hooks/use-column-text-filters";

import { CANCELLATION_FILTER_KEYS } from "../../list-filters";

export type RequestStatus = (typeof CANCELLATION_REQUEST_STATUSES)[number];
const STATUS_FILTERS = [...CANCELLATION_REQUEST_STATUSES, "ALL"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
/** Hàng đợi mặc định: yêu cầu đang chờ Sale quyết (docs 17 §4.8 bước 28). */
export const DEFAULT_REQUEST_STATUS: RequestStatus = "PENDING";

/**
 * Bộ lọc trên URL (nuqs) của trang yêu cầu huỷ:
 * - `status` → BE (`GET /orders/cancellation-requests?status`, MỘT giá trị; `ALL` = không gửi). Mặc định PENDING.
 * - `q` + lọc header cột → BE không có tham số tìm: chỉ xét trang đang xem, không gọi lại API.
 * Đổi trạng thái → về trang đầu.
 */
export function useCancellationFilters() {
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    parseAsStringLiteral(STATUS_FILTERS).withDefault(DEFAULT_REQUEST_STATUS),
  );
  const [, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const columns = useColumnTextFilters(CANCELLATION_FILTER_KEYS);
  const statusChanged = statusFilter !== DEFAULT_REQUEST_STATUS;
  const rowFilterActive = q.trim() !== "" || columns.active;
  return {
    q,
    setQ: (next: string) => void setQ(next || null),
    statusFilter,
    /** Tham số gửi BE; `undefined` = mọi trạng thái. */
    status: statusFilter === "ALL" ? undefined : statusFilter,
    statusChanged,
    setStatus: (next: StatusFilter) => {
      void setStatusFilter(next === DEFAULT_REQUEST_STATUS ? null : next);
      void setPage(null);
    },
    columns,
    rowFilterActive,
    active: rowFilterActive || statusChanged,
    clear: () => {
      void setQ(null);
      void setStatusFilter(null);
      void setPage(null);
      columns.clear();
    },
  };
}
export type CancellationFilters = ReturnType<typeof useCancellationFilters>;
