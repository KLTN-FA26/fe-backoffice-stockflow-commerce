"use client";

import { cn } from "cn";
import { Plus } from "lucide-react";

import {
  CYCLE_COUNT_COLUMNS as C,
  CYCLE_COUNT_CREATE_LABELS,
  CYCLE_COUNT_LABELS,
  CYCLE_COUNT_STATUSES,
} from "@/constants/cycle-count";

import { statusLabelVi } from "@/lib/status-map";

import {
  ListToolbar,
  TOOLBAR_ACTION_CLASS,
  TOOLBAR_PRIMARY_CLASS,
} from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { CYCLE_COUNT_DATA_COLUMNS, LOCKED_CYCLE_COUNT_COLUMNS } from "./useCycleCountColumns";

import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { useCycleCountFilters } from "../use-cycle-count-filters";
import type { CycleCountColumn, CycleCountColumnsState } from "./useCycleCountColumns";

type CycleCountStatus = (typeof CYCLE_COUNT_STATUSES)[number];
type FiltersState = ReturnType<typeof useCycleCountFilters>;

const L = CYCLE_COUNT_LABELS;
const statusLabel = (status: CycleCountStatus) => statusLabelVi(status, "stock") ?? status;
const STATUS_OPTIONS = CYCLE_COUNT_STATUSES.map((value) => ({ value, label: statusLabel(value) }));
const COLUMN_LABELS: Record<CycleCountColumn, string> = {
  [C.NUMBER]: L.number,
  [C.TRIGGER]: L.trigger,
  [C.STATUS]: L.status,
  [C.BLIND]: L.blind,
  [C.PROGRESS]: L.progress,
  [C.VARIANCES]: L.variances,
  [C.PLANNED_DATE]: L.plannedDate,
};
const COLUMN_OPTIONS = CYCLE_COUNT_DATA_COLUMNS.map((value) => ({
  value,
  label: COLUMN_LABELS[value],
}));

/** Chip thanh `Cấu hình` (data-table-mode-a §3): mỗi nhóm một chip, X bỏ riêng nhóm đó. */
function summaryItems(state: FiltersState, columns: CycleCountColumnsState): ListSummaryItem[] {
  return [
    {
      label: L.status,
      value: state.status ? statusLabel(state.status) : L.all,
      active: Boolean(state.status),
      onClear: () => void state.setStatus(null),
    },
    {
      label: L.summaryColumns,
      value: `${columns.visible.length}/${CYCLE_COUNT_DATA_COLUMNS.length}`,
      active: columns.hasColumnConfig,
      onClear: columns.reset,
    },
  ];
}

/**
 * Toolbar danh sách phiếu kiểm kê (Mode A, style Vercel): không có search chính — BE không có tham số tìm cho danh
 * sách phân trang phía server. Lọc trạng thái (một giá trị, trên URL), ẩn hiện cột, nút "Lập phiếu" theo quyền.
 */
export function CycleCountToolbar({
  state,
  columns,
  canPlan,
  onPlan,
}: {
  state: FiltersState;
  columns: CycleCountColumnsState;
  /** UI-only — Backend phải re-check (inventory-cycle-counts:CREATE, docs 20 §4.2 a). */
  canPlan: boolean;
  onPlan: () => void;
}) {
  const status = state.status;
  return (
    <ListToolbar<CycleCountStatus, string, CycleCountColumn>
      statusOptions={STATUS_OPTIONS}
      selectedStatuses={status ? [status] : []}
      // BE nhận MỘT trạng thái → chọn một, bấm lại để bỏ
      onToggleStatus={(value) => void state.setStatus(status === value ? null : value)}
      onClearStatuses={() => void state.setStatus(null)}
      hasStatusFilter={Boolean(status)}
      columnOptions={COLUMN_OPTIONS}
      selectedColumns={columns.visible}
      defaultColumns={[...CYCLE_COUNT_DATA_COLUMNS]}
      lockedColumns={LOCKED_CYCLE_COUNT_COLUMNS}
      visibleColumnCount={columns.visible.length}
      onToggleColumn={columns.toggle}
      onResetColumns={columns.reset}
      hasColumnConfig={columns.hasColumnConfig}
      summaryItems={summaryItems(state, columns)}
      onResetAll={() => {
        void state.reset();
        columns.reset();
      }}
      resetDisabled={!state.hasFilters && !columns.hasColumnConfig}
      actions={
        canPlan && (
          <Button
            type="button"
            size="sm"
            className={cn(TOOLBAR_ACTION_CLASS, TOOLBAR_PRIMARY_CLASS)}
            onClick={onPlan}
          >
            <Plus className="size-3.5" />
            {CYCLE_COUNT_CREATE_LABELS.action}
          </Button>
        )
      }
    />
  );
}
