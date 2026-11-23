"use client";

import { STORAGE_KEYS, UI_LABELS, WAREHOUSE_CAPACITY_COLUMNS as C } from "@/constants";
import {
  columnSummaryItem,
  columnToolbarProps,
  useColumnVisibility,
} from "@/hooks/use-column-visibility";
import { ListToolbar } from "@/components/shared/ListToolbar";

import type { ColumnVisibility } from "@/hooks/use-column-visibility";

const L = UI_LABELS.warehouseCapacity;

export type CapacityColumn = (typeof C)[keyof typeof C];

/** Thứ tự cột của bảng (docs 06 §4.6 bước 3) — mặc định hiện hết. */
export const CAPACITY_COLUMNS: readonly CapacityColumn[] = [
  C.WAREHOUSE,
  C.CAPACITY,
  C.OCCUPIED,
  C.INCOMING,
  C.PROJECTED_FREE,
  C.PENDING,
  C.FREE_IF_ALL_APPROVED,
  C.OUTGOING,
  C.ACTIONS,
];
/** Cột kho (mã + tên, bấm sang chi tiết) và nút xem luôn hiện (data-table-mode-a §4.2). */
const LOCKED: readonly CapacityColumn[] = [C.WAREHOUSE, C.ACTIONS];
const OPTIONS = { locked: LOCKED };

const COLUMN_NAMES: Record<CapacityColumn, string> = {
  [C.WAREHOUSE]: L.column.warehouse,
  [C.CAPACITY]: L.column.capacity,
  [C.OCCUPIED]: L.column.occupied,
  [C.INCOMING]: L.column.incoming,
  [C.PROJECTED_FREE]: L.column.projectedFree,
  [C.PENDING]: L.column.pending,
  [C.FREE_IF_ALL_APPROVED]: L.column.freeIfAllApproved,
  [C.OUTGOING]: L.column.outgoing,
  [C.ACTIONS]: L.detailTitle,
};

/** Cột đang hiện — sở thích cá nhân, lưu localStorage (state-persistence), không lên URL. */
export function useCapacityColumns() {
  return useColumnVisibility(STORAGE_KEYS.adminWarehouseCapacityConfig, CAPACITY_COLUMNS, OPTIONS);
}

/**
 * Toolbar Bảng sức chứa (style Vercel): search chính trên URL (lọc tại chỗ — BE trả đủ mọi kho), ẩn hiện cột,
 * thanh `Cấu hình`.
 */
export function CapacityToolbar({
  q,
  onSearchChange,
  columns,
}: {
  q: string;
  onSearchChange: (value: string) => void;
  columns: ColumnVisibility<CapacityColumn>;
}) {
  return (
    <ListToolbar<string, string, CapacityColumn>
      search={q}
      onSearchChange={onSearchChange}
      searchPlaceholder={L.searchPlaceholder}
      {...columnToolbarProps(columns, COLUMN_NAMES, CAPACITY_COLUMNS)}
      summaryItems={[
        {
          label: L.summarySearch,
          value: q || UI_LABELS.common.notEntered,
          active: q !== "",
          onClear: () => onSearchChange(""),
        },
        columnSummaryItem(columns),
      ]}
      onResetAll={() => {
        onSearchChange("");
        columns.reset();
      }}
      resetDisabled={q === "" && !columns.hasColumnConfig}
    />
  );
}
