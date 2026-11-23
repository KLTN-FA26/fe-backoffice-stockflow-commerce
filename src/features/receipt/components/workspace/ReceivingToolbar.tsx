"use client";

import { RECEIPT_COLUMNS as C, RECEIVING_LABELS } from "@/constants";
import { columnSummaryItem, columnToolbarProps } from "@/hooks/use-column-visibility";
import { ListToolbar } from "@/components/shared/ListToolbar";

import { COLUMN_LABELS } from "../list/constants";

import type { ColumnVisibility } from "@/hooks/use-column-visibility";

const L = RECEIVING_LABELS;

/** `?tab=` — giữ tên tham số cũ để link cũ (`?tab=all`) vẫn mở đúng. Mặc định `draft`. */
export const RECEIVING_TABS = ["draft", "all"] as const;
export type ReceivingTab = (typeof RECEIVING_TABS)[number];
export const DEFAULT_RECEIVING_TAB: ReceivingTab = "draft";

export type ReceivingColumn = Exclude<(typeof C)[keyof typeof C], typeof C.CONFIRMED_AT>;

/** Cột của màn kho. "Xác nhận lúc" chỉ ở trang Phiếu nhận — màn kho gọn cho người đứng ở khu nhận hàng. */
export const RECEIVING_COLUMNS: readonly ReceivingColumn[] = [
  C.NUMBER,
  C.RECEIPT_TYPE,
  C.PRODUCTION_ORDER,
  C.DELIVERY_NOTE,
  C.RECEIVED_AT,
  C.STATUS,
  C.ACTIONS,
];
/** Số phiếu (link sang màn nhận) và cột thao tác luôn hiện (data-table-mode-a §4.2). */
export const LOCKED_RECEIVING_COLUMNS: readonly ReceivingColumn[] = [C.NUMBER, C.ACTIONS];

const COLUMN_NAMES = Object.fromEntries(
  RECEIVING_COLUMNS.map((column) => [column, COLUMN_LABELS[column] ?? column]),
) as Record<ReceivingColumn, string>;

const TAB_OPTIONS = RECEIVING_TABS.map((value) => ({ value, label: L.tabs[value] }));

/**
 * Toolbar Nhận hàng (style Vercel): BE không có tìm kiếm theo kho trên màn này nên không có ô search. "Đang nhận /
 * Tất cả" là lọc trạng thái chọn một (như lọc trạng thái kho) — giữ nguyên tham số BE của hai lựa chọn.
 */
export function ReceivingToolbar({
  tab,
  onTabChange,
  columns,
}: {
  tab: ReceivingTab;
  onTabChange: (tab: ReceivingTab) => void;
  columns: ColumnVisibility<ReceivingColumn>;
}) {
  const filtered = tab !== DEFAULT_RECEIVING_TAB;
  return (
    <ListToolbar<ReceivingTab, string, ReceivingColumn>
      statusOptions={TAB_OPTIONS}
      selectedStatuses={[tab]}
      onToggleStatus={onTabChange}
      onClearStatuses={() => onTabChange(DEFAULT_RECEIVING_TAB)}
      hasStatusFilter={filtered}
      {...columnToolbarProps(columns, COLUMN_NAMES, RECEIVING_COLUMNS)}
      summaryItems={[
        {
          label: L.summaryStatus,
          value: L.tabs[tab],
          active: filtered,
          onClear: () => onTabChange(DEFAULT_RECEIVING_TAB),
        },
        columnSummaryItem(columns),
      ]}
      onResetAll={() => {
        onTabChange(DEFAULT_RECEIVING_TAB);
        columns.reset();
      }}
      resetDisabled={!filtered && !columns.hasColumnConfig}
    />
  );
}
