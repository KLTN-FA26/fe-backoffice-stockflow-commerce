import { STATUS_LABEL_VI } from "@/lib/domain/status-map";

import { DEFAULT_COLUMNS, SEARCH_SCOPE_LABEL } from "./constants";

import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { LoadListState } from "./useLoadListState";

/** Thanh "Cấu hình" dưới toolbar (data-table-mode-a §3). */
export function buildLoadSummary(s: LoadListState): ListSummaryItem[] {
  const { filters } = s;
  const statusLabel = filters.status.map((v) => STATUS_LABEL_VI[v] ?? v).join(", ");
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
      label: "Cột hiển thị",
      value: `${s.visibleColumnCount}/${DEFAULT_COLUMNS.length - 1}`,
      active: s.hasColumnConfig,
      onClear: () => s.updateConfig((c) => ({ ...c, visibleColumns: DEFAULT_COLUMNS })),
    },
  ];
}
