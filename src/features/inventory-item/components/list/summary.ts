import { UI_LABELS } from "@/constants";

import { DEFAULT_COLUMNS, SEARCH_SCOPE_LABEL } from "./constants";

import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { InventoryItemListState } from "./useInventoryItemListState";

/** Thanh "Cấu hình" dưới toolbar (data-table-mode-a §3). Không có "Search trong cột" vì BE không hỗ trợ. */
const S = UI_LABELS.inventoryItem.summary;

export function buildSummaryItems(s: InventoryItemListState): ListSummaryItem[] {
  const { filters } = s;

  return [
    {
      label: S.search,
      value: filters.q.trim() ? `“${filters.q}”` : S.none,
      active: filters.q.trim() !== "",
      onClear: () => void filters.setQ(""),
    },
    { label: S.scope, value: SEARCH_SCOPE_LABEL },
    {
      label: S.columns,
      value: `${s.config.visibleColumns.length}/${DEFAULT_COLUMNS.length}`,
      active: s.hasColumnConfig,
      onClear: () => s.updateConfig((c) => ({ ...c, visibleColumns: DEFAULT_COLUMNS })),
    },
  ];
}
