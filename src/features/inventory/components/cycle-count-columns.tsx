"use client";

import Link from "next/link";

import {
  CYCLE_COUNT_COLUMNS as C,
  CYCLE_COUNT_LABELS,
  CYCLE_COUNT_STATUS,
  CYCLE_COUNT_TRIGGER_LABELS,
  CYCLE_COUNT_TRIGGERS,
} from "@/constants/cycle-count";
import {
  CELL,
  dateCell,
  refCell,
  statusCell,
  textCell,
  viewColumn,
} from "@/components/shared/column-helpers";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { CycleCountSummary } from "../cycle-count-types";
import type { CycleCountColumn } from "./useCycleCountColumns";

const L = CYCLE_COUNT_LABELS;

// Docs 20 §5.2: a source the app does not know yet is shown verbatim, never hidden.
export function triggerLabel(trigger: string): string {
  const known = CYCLE_COUNT_TRIGGERS.find((value) => value === trigger);
  return known ? CYCLE_COUNT_TRIGGER_LABELS[known] : trigger;
}

/** Phiếu đang mở = row "cần chú ý" (data-table-mode-a) — gắn `data-flagged`, không tô viền. */
export const isOpenCycleCount = (row: CycleCountSummary) =>
  row.status === CYCLE_COUNT_STATUS.PLANNED || row.status === CYCLE_COUNT_STATUS.IN_PROGRESS;

/** Cột bảng phiếu kiểm kê — chuẩn ô bảng Mode A (column-helpers); dữ liệu theo `visible`, cột "Mở phiếu" luôn cuối. */
export function buildCycleCountColumns(
  /** Cột dữ liệu đang hiện, theo thứ tự (`useCycleCountColumns`). */
  visible: readonly CycleCountColumn[],
  /** Link chi tiết phiếu — trong tab theo kho (`WORKSPACE_PATHS.cycleCount`). */
  detailHref: (countId: string) => string,
): ColumnDef<CycleCountSummary>[] {
  const all: Record<CycleCountColumn, ColumnDef<CycleCountSummary>> = {
    [C.NUMBER]: {
      key: C.NUMBER,
      header: L.number,
      cell: (row) => (
        <Link
          href={detailHref(row.id)}
          className={`${CELL.code} hover:underline`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.countNumber}
        </Link>
      ),
    },
    [C.TRIGGER]: textCell<CycleCountSummary>(
      C.TRIGGER,
      L.trigger,
      (row) => triggerLabel(row.triggerType),
      { color: "primary" },
    ),
    [C.STATUS]: statusCell<CycleCountSummary>(C.STATUS, L.status, (row) => row.status, "stock"),
    [C.BLIND]: textCell<CycleCountSummary>(C.BLIND, L.blind, (row) =>
      row.blind ? L.blindBadge : "",
    ),
    [C.PROGRESS]: {
      key: C.PROGRESS,
      header: L.progress,
      align: "right",
      cell: (row) => (
        <span className={CELL.number}>
          {row.countedCount}/{row.lineCount}
        </span>
      ),
    },
    // `varianceCount` vắng với người đếm trên phiếu kiểm mù (docs 20 BR-07) → "—", không suy ra.
    [C.VARIANCES]: refCell<CycleCountSummary>(C.VARIANCES, L.variances, (row) =>
      row.varianceCount == null ? null : String(row.varianceCount),
    ),
    [C.PLANNED_DATE]: dateCell<CycleCountSummary>(
      C.PLANNED_DATE,
      L.plannedDate,
      (row) => row.plannedDate ?? null,
    ),
  };
  return [
    ...visible.map((key) => all[key]),
    viewColumn<CycleCountSummary>((row) => ({
      label: `${L.open} ${row.countNumber}`,
      href: detailHref(row.id),
    })),
  ];
}
