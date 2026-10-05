import { COLUMN_LABELS, DEFAULT_COLUMNS, SEARCH_SCOPE_LABEL, STATUS_OPTIONS } from "./constants";

import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { OrderListState } from "./useOrderListState";

/** Thanh "Cấu hình" dưới toolbar (data-table-mode-a §3). Không có "Search trong cột" vì server không hỗ trợ. */
export function buildSummaryItems(s: OrderListState): ListSummaryItem[] {
  const { filters } = s;
  const statusLabel = filters.status
    .map((v) => STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v)
    .join(", ");
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
      label: "Sắp xếp",
      value: s.sort.key
        ? `${COLUMN_LABELS[s.sort.key]} (${s.sort.direction === "asc" ? "tăng" : "giảm"})`
        : "Mặc định (mới đặt trước)",
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
