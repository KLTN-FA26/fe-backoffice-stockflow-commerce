"use client";

import { parseAsArrayOf, parseAsStringLiteral, useQueryState } from "nuqs";

import {
  RETURN_FILTER_STATUSES,
  RETURN_OPEN_STATUSES,
  RETURN_STATUS_BY_API,
} from "@/constants/returns";
import { statusLabelVi } from "@/lib/status-map";

import type { ReturnApiStatus } from "@/constants/returns";

/** Trạng thái lọc được (bỏ `INSPECTED`, BE 4D-3). */
export type ReturnFilterStatus = (typeof RETURN_FILTER_STATUSES)[number];
const STATUS_PARSER = parseAsArrayOf(parseAsStringLiteral(RETURN_FILTER_STATUSES)).withDefault([]);

/** Nhãn Việt của trạng thái (domain `rma` — cùng nguồn với `StatusDot` trên dòng). */
export function returnStatusLabel(status: ReturnApiStatus): string {
  const display = RETURN_STATUS_BY_API[status];
  return statusLabelVi(display, "rma") ?? display;
}

/**
 * Lọc trạng thái của hàng đợi trả hàng — gửi BE (`GET /returns?status=…`, lặp tham số), lưu URL `status`.
 * Lựa chọn nằm trong phạm vi tab: "Đang xử lý" chỉ có các trạng thái mở (BE `ReturnStatus.isOpen`); các tab khác có mọi
 * trạng thái lọc được. Không chọn gì → mặc định của tab (mở / tất cả).
 */
export function useReturnStatusFilter(openTab: boolean) {
  const [selected, setSelected] = useQueryState("status", STATUS_PARSER);
  const allowed: readonly ReturnFilterStatus[] = openTab
    ? RETURN_OPEN_STATUSES
    : RETURN_FILTER_STATUSES;
  const inTab = selected.filter((status) => allowed.includes(status));
  return {
    openTab,
    selected: inTab,
    options: allowed.map((value) => ({ value, label: returnStatusLabel(value) })),
    /** Tham số gửi BE: lựa chọn trong tab, rỗng → mặc định của tab. */
    statuses: inTab.length > 0 ? inTab : openTab ? RETURN_OPEN_STATUSES : undefined,
    active: inTab.length > 0,
    toggle: (status: ReturnFilterStatus) =>
      void setSelected(
        inTab.includes(status) ? inTab.filter((s) => s !== status) : [...inTab, status],
      ),
    clear: () => void setSelected(null),
  };
}
export type ReturnStatusFilter = ReturnType<typeof useReturnStatusFilter>;
