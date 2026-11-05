import {
  DEFAULT_COLUMNS,
  FILTER_OPTIONS,
  POLICY_PREFIX,
  SEARCH_SCOPE_LABEL,
  STORAGE_PREFIX,
  SUMMARY_LABELS as S,
} from "./constants";

import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { InventoryItemListState } from "./useInventoryItemListState";

/** Thanh "Cấu hình" dưới toolbar (data-table-mode-a §3). Không có "Search trong cột" vì BE không hỗ trợ. */
export function buildSummaryItems(s: InventoryItemListState): ListSummaryItem[] {
  const { filters } = s;
  const labelOf = (prefix: string) => {
    const hit = filters.status.find((v) => v.startsWith(prefix));
    return hit ? (FILTER_OPTIONS.find((o) => o.value === hit)?.label ?? hit) : undefined;
  };
  const clearGroup = (prefix: string) =>
    void filters.setStatus(filters.status.filter((v) => !v.startsWith(prefix)));
  const policy = labelOf(POLICY_PREFIX);
  const storage = labelOf(STORAGE_PREFIX);

  return [
    {
      label: S.search,
      value: filters.q.trim() ? `“${filters.q}”` : S.none,
      active: filters.q.trim() !== "",
      onClear: () => void filters.setQ(""),
    },
    { label: S.scope, value: SEARCH_SCOPE_LABEL },
    {
      label: S.policy,
      value: policy ?? S.all,
      active: policy !== undefined,
      onClear: () => clearGroup(POLICY_PREFIX),
    },
    {
      label: S.storage,
      value: storage ?? S.all,
      active: storage !== undefined,
      onClear: () => clearGroup(STORAGE_PREFIX),
    },
    {
      label: S.columns,
      value: `${s.config.visibleColumns.length}/${DEFAULT_COLUMNS.length}`,
      active: s.hasColumnConfig,
      onClear: () => s.updateConfig((c) => ({ ...c, visibleColumns: DEFAULT_COLUMNS })),
    },
  ];
}
