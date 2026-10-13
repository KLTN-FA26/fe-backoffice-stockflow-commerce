import { STATUS_LABEL_VI } from "@/lib/domain/status-map";
import { formatDate } from "@/lib/format/date";

import { COLUMN_LABELS, DEFAULT_COLUMNS, SEARCH_SCOPE_LABEL } from "./constants";

import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { ReceiptListState } from "./useReceiptListState";

function dayLabel(day: string): string {
  return formatDate(`${day}T00:00:00+07:00`);
}

/** Thanh "Cấu hình" dưới toolbar (data-table-mode-a §3). BE không có search trong cột. */
export function buildReceiptSummary(
  s: ReceiptListState,
  poNumber: string | undefined,
): ListSummaryItem[] {
  const { filters } = s;
  const statusLabel = filters.status.map((v) => STATUS_LABEL_VI[v] ?? v).join(", ");
  const range =
    s.receivedFrom || s.receivedTo
      ? `${s.receivedFrom ? dayLabel(s.receivedFrom) : "…"} → ${s.receivedTo ? dayLabel(s.receivedTo) : "…"}`
      : "Tất cả";
  return [
    {
      label: "Search chính",
      value: filters.q.trim() ? `“${filters.q}”` : "Chưa dùng",
      active: filters.q.trim() !== "",
      onClear: () => void filters.setQ(""),
    },
    { label: "Trường search", value: SEARCH_SCOPE_LABEL },
    {
      label: "Trạng thái",
      value: statusLabel || "Tất cả",
      active: filters.status.length > 0,
      onClear: () => void filters.setStatus([]),
    },
    {
      label: "Ngày nhận",
      value: range,
      active: !!(s.receivedFrom || s.receivedTo),
      onClear: () => {
        s.setFrom("");
        s.setTo("");
      },
    },
    {
      label: "Đơn đặt hàng",
      value: s.po ? (poNumber ?? s.po) : "Tất cả",
      active: !!s.po,
      onClear: () => s.setPo(""),
    },
    {
      label: "Sắp xếp",
      value: s.sort.key
        ? `${COLUMN_LABELS[s.sort.key]} (${s.sort.direction === "asc" ? "tăng" : "giảm"})`
        : "Mặc định (ngày nhận mới nhất)",
      active: s.sort.key !== null,
      onClear: () => void filters.setSort(""),
    },
    {
      label: "Cột hiển thị",
      value: `${s.visibleColumnCount}/${DEFAULT_COLUMNS.length - 1}`,
      active: s.hasColumnConfig,
      onClear: () => s.updateConfig((c) => ({ ...c, visibleColumns: DEFAULT_COLUMNS })),
    },
  ];
}
