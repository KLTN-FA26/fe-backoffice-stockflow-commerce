"use client";

import Link from "next/link";
import { Route } from "lucide-react";

import {
  PUTAWAY_LABELS,
  PUTAWAY_TRIP_LABELS,
  PUTAWAY_TRIP_PERMISSIONS,
  UI_LABELS,
  WORKSPACE_PATHS,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { useWorkspaceHref } from "@/lib/workspace";
import { ListToolbar, TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";

import { LOCKED_PUTAWAY_COLUMNS, PUTAWAY_DATA_COLUMNS } from "./usePutawayColumns";

import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { PutawayColumn, PutawayColumnsState } from "./usePutawayColumns";
import type { PutawayFiltersState } from "./usePutawayFilters";

const L = PUTAWAY_LABELS;
const COLUMN_OPTIONS = PUTAWAY_DATA_COLUMNS.map((value) => ({ value, label: L.column[value] }));

/** Chip thanh `Cấu hình` (data-table-mode-a §3): mỗi nhóm một chip, X bỏ riêng nhóm đó. */
function summaryItems(state: PutawayFiltersState, columns: PutawayColumnsState): ListSummaryItem[] {
  const { filters, set } = state;
  return [
    {
      label: L.summarySearch,
      value: filters.q.trim() ? `“${filters.q}”` : UI_LABELS.common.notEntered,
      active: filters.q.trim() !== "",
      onClear: () => set({ q: "" }),
    },
    ...(filters.receipt
      ? [
          {
            label: L.receiptFilter,
            value: L.receipt,
            active: true,
            onClear: () => set({ receipt: null }),
          },
        ]
      : []),
    {
      label: L.summaryColumns,
      value: `${columns.visible.length}/${PUTAWAY_DATA_COLUMNS.length}`,
      active: columns.hasColumnConfig,
      onClear: columns.reset,
    },
  ];
}

/**
 * Toolbar danh sách cất hàng (Mode A, style Vercel): search chính (lọc client — BE không có tìm kiếm), ẩn hiện cột,
 * thanh `Cấu hình`. Kho là kho của tab — không có ô chọn kho. Một ô tìm duy nhất cho LPN / SKU / lô / vị trí.
 */
export function PutawayToolbar({
  state,
  columns,
}: {
  state: PutawayFiltersState;
  columns: PutawayColumnsState;
}) {
  const canTrip = useCan(PUTAWAY_TRIP_PERMISSIONS.viewPage);
  const tripHref = useWorkspaceHref()(WORKSPACE_PATHS.myTrip);
  return (
    <ListToolbar<string, string, PutawayColumn>
      actions={
        // Gom nhiều thùng lên một xe (docs 05 §4.5) — chuyến mở ở kho của tab
        canTrip && (
          <Link
            href={tripHref}
            className={`border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted inline-flex items-center border font-medium ${TOOLBAR_ACTION_CLASS}`}
          >
            <Route className="text-dot-info size-3.5" />
            {PUTAWAY_TRIP_LABELS.openAction}
          </Link>
        )
      }
      search={state.filters.q}
      onSearchChange={(q) => state.set({ q })}
      searchPlaceholder={L.searchPlaceholder}
      columnOptions={COLUMN_OPTIONS}
      selectedColumns={columns.visible}
      defaultColumns={[...PUTAWAY_DATA_COLUMNS]}
      lockedColumns={LOCKED_PUTAWAY_COLUMNS}
      visibleColumnCount={columns.visible.length}
      onToggleColumn={columns.toggle}
      onResetColumns={columns.reset}
      hasColumnConfig={columns.hasColumnConfig}
      summaryItems={summaryItems(state, columns)}
      onResetAll={() => {
        state.reset();
        columns.reset();
      }}
      resetDisabled={!state.hasFilters && !columns.hasColumnConfig}
    />
  );
}
