import { UI_LABELS } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";

import { DEFAULT_COLUMNS, SEARCH_SCOPE_LABEL } from "./constants";

import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { TransferListState } from "./useTransferListState";

/** Thanh "Cấu hình" dưới toolbar (data-table-mode-a §3). BE không có search trong cột. */
export function buildTransferSummary(
  s: TransferListState,
  warehouseLabel: (id: string) => string,
): ListSummaryItem[] {
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
      value: statusLabel || UI_LABELS.transfer.field.all,
      active: filters.status.length > 0,
      onClear: () => void filters.setStatus([]),
    },
    {
      label: UI_LABELS.transfer.field.fromWarehouse,
      value: s.from ? warehouseLabel(s.from) : UI_LABELS.transfer.field.all,
      active: !!s.from,
      onClear: () => s.setFrom(""),
    },
    {
      label: UI_LABELS.transfer.field.toWarehouse,
      value: s.to ? warehouseLabel(s.to) : UI_LABELS.transfer.field.all,
      active: !!s.to,
      onClear: () => s.setTo(""),
    },
    {
      label: "Cột hiển thị",
      value: `${s.visibleColumnCount}/${DEFAULT_COLUMNS.length - 1}`,
      active: s.hasColumnConfig,
      onClear: () => s.updateConfig((c) => ({ ...c, visibleColumns: DEFAULT_COLUMNS })),
    },
  ];
}
