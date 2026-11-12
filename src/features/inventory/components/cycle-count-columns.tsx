"use client";

import Link from "next/link";

import {
  CYCLE_COUNT_LABELS,
  CYCLE_COUNT_ROUTES,
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

const L = CYCLE_COUNT_LABELS;

// Docs 20 §5.2: a source the app does not know yet is shown verbatim, never hidden.
export function triggerLabel(trigger: string): string {
  const known = CYCLE_COUNT_TRIGGERS.find((value) => value === trigger);
  return known ? CYCLE_COUNT_TRIGGER_LABELS[known] : trigger;
}

/** Phiếu đang mở = row "cần chú ý" (data-table-mode-a) — gắn `data-flagged`, không tô viền. */
export const isOpenCycleCount = (row: CycleCountSummary) =>
  row.status === CYCLE_COUNT_STATUS.PLANNED || row.status === CYCLE_COUNT_STATUS.IN_PROGRESS;

/** Cột bảng phiếu kiểm kê — chuẩn ô bảng Mode A (column-helpers). */
export function buildCycleCountColumns(): ColumnDef<CycleCountSummary>[] {
  return [
    {
      key: "countNumber",
      header: L.number,
      cell: (row) => (
        <Link
          href={CYCLE_COUNT_ROUTES.detail(row.id)}
          className={`${CELL.code} hover:underline`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.countNumber}
        </Link>
      ),
    },
    textCell<CycleCountSummary>("trigger", L.trigger, (row) => triggerLabel(row.triggerType), {
      color: "primary",
    }),
    statusCell<CycleCountSummary>("status", L.status, (row) => row.status, "stock"),
    textCell<CycleCountSummary>("blind", L.blind, (row) => (row.blind ? L.blindBadge : "")),
    {
      key: "progress",
      header: L.progress,
      align: "right",
      cell: (row) => (
        <span className={CELL.number}>
          {row.countedCount}/{row.lineCount}
        </span>
      ),
    },
    // `varianceCount` vắng với người đếm trên phiếu kiểm mù (docs 20 BR-07) → "—", không suy ra.
    refCell<CycleCountSummary>("variances", L.variances, (row) =>
      row.varianceCount == null ? null : String(row.varianceCount),
    ),
    dateCell<CycleCountSummary>("plannedDate", L.plannedDate, (row) => row.plannedDate ?? null),
    viewColumn<CycleCountSummary>((row) => ({
      label: `${L.open} ${row.countNumber}`,
      href: CYCLE_COUNT_ROUTES.detail(row.id),
    })),
  ];
}
