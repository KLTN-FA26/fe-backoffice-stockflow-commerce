import { INVENTORY_ITEM_COLUMNS as C, UI_LABELS } from "@/constants";

import { COLUMN_LABELS, DEFAULT_COLUMNS, SEARCH_SCOPE_LABEL } from "./constants";

import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { InventoryItemListState } from "./useInventoryItemListState";

/** Thanh "Cấu hình" dưới toolbar (data-table-mode-a §3); lọc cột chỉ hiện viên khi đang dùng. */
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
    ...columnFilterItems(s),
    {
      label: S.columns,
      value: `${s.config.visibleColumns.length}/${DEFAULT_COLUMNS.length}`,
      active: s.hasColumnConfig,
      onClear: () => s.updateConfig((c) => ({ ...c, visibleColumns: DEFAULT_COLUMNS })),
    },
  ];
}

/** Viên "SKU “…”" / "Mã vạch “…”" cho lọc trên header cột — chỉ khi đang lọc, bấm xoá bỏ lọc cột đó. */
function columnFilterItems(s: InventoryItemListState): ListSummaryItem[] {
  const { sku, barcode } = s.columnSearch;
  const items: ListSummaryItem[] = [];
  if (sku.trim()) {
    items.push({
      label: COLUMN_LABELS[C.SKU],
      value: `“${sku}”`,
      active: true,
      onClear: () => s.setSkuFilter(""),
    });
  }
  if (barcode.trim()) {
    items.push({
      label: COLUMN_LABELS[C.BARCODE],
      value: `“${barcode}”`,
      active: true,
      onClear: () => s.setBarcodeFilter(""),
    });
  }
  return items;
}
