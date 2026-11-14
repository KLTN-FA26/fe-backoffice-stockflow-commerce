"use client";

import Link from "next/link";
import { CheckCircle2, Circle, XCircle } from "lucide-react";

import { CYCLE_COUNT_LABELS, CYCLE_COUNT_LINE_STATE } from "@/constants/cycle-count";
import { INVENTORY_ROUTES } from "@/constants/inventory";
import { CELL, refCell, textCell } from "@/components/shared/column-helpers";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { lineState, lineVariance } from "../cycle-count-selectors";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { CycleCountLine } from "../cycle-count-types";

const L = CYCLE_COUNT_LABELS;
const STATE_VIEW = {
  [CYCLE_COUNT_LINE_STATE.PENDING]: { icon: Circle, tone: "text-ink-tertiary" },
  [CYCLE_COUNT_LINE_STATE.PRESENT]: { icon: CheckCircle2, tone: "text-positive" },
  [CYCLE_COUNT_LINE_STATE.MISSING]: { icon: XCircle, tone: "text-danger" },
} as const;
const VARIANCE_LABEL = {
  shortage: L.shortage,
  surplus: L.surplus,
  none: L.noVariance,
} as const;

export interface LineColumnOptions {
  /** Sổ sách chỉ có khi người xem được thấy (docs 20 BR-07) — cột ẩn đi khi phiếu kiểm mù với người đếm. */
  showBooks: boolean;
  showAdjustments: boolean;
  /** Người đếm còn đếm được (phiếu mở + quyền UPDATE): hiện nút "Không thấy". */
  canCount: boolean;
  busyLineId: string | null;
  onMissing: (line: CycleCountLine) => void;
  /** Đếm lại: chỉ dòng có điều chỉnh bị từ chối được chọn. */
  recount: { enabled: boolean; selectable: ReadonlySet<string>; selected: ReadonlySet<string> };
  onToggleRecount: (line: CycleCountLine) => void;
}

export function buildLineColumns(options: LineColumnOptions): ColumnDef<CycleCountLine>[] {
  const columns: ColumnDef<CycleCountLine>[] = [];
  if (options.recount.enabled) {
    columns.push({
      key: "recount",
      header: L.recountColumn,
      cell: (line) =>
        options.recount.selectable.has(line.id) ? (
          <Checkbox
            aria-label={L.recountPick(line.lpn ?? line.locationCode)}
            checked={options.recount.selected.has(line.id)}
            onCheckedChange={() => options.onToggleRecount(line)}
          />
        ) : null,
    });
  }
  columns.push(
    refCell<CycleCountLine>("location", L.location, (line) => line.locationCode),
    {
      key: "lpn",
      header: L.lpn,
      cell: (line) => <span className={CELL.code}>{line.lpn ?? L.missing}</span>,
    },
    refCell<CycleCountLine>("sku", L.sku, (line) => line.sku),
    refCell<CycleCountLine>("lot", L.lot, (line) => line.lotNumber),
    {
      key: "counted",
      header: L.counted,
      cell: (line) => {
        const state = lineState(line);
        const { icon: Icon, tone } = STATE_VIEW[state];
        return (
          <span className={`inline-flex items-center gap-1.5 text-[0.8125rem] font-medium ${tone}`}>
            <Icon className="size-4" aria-hidden />
            {L.lineState[state]}
            {line.recountRequired && (
              <span className="text-ink-tertiary">({L.recountRequired})</span>
            )}
          </span>
        );
      },
    },
  );
  if (options.showBooks) {
    columns.push(
      textCell<CycleCountLine>("booked", L.booked, (line) =>
        line.booked == null ? "" : line.booked ? L.bookedYes : L.bookedNo,
      ),
      textCell<CycleCountLine>("variance", L.variance, (line) => {
        const variance = lineVariance(line);
        return variance ? VARIANCE_LABEL[variance] : "";
      }),
    );
  }
  if (options.showAdjustments) {
    columns.push({
      key: "adjustments",
      header: L.adjustment,
      cell: (line) => (
        <div className="flex flex-col gap-1">
          {(line.adjustments ?? []).map((adjustment) => (
            <span key={adjustment.id} className="flex items-center gap-2">
              <Link
                href={INVENTORY_ROUTES.adjustment(adjustment.id)}
                className={`${CELL.code} hover:underline`}
              >
                {adjustment.number}
              </Link>
              <StatusDot domain="stock" status={adjustment.status} />
            </span>
          ))}
        </div>
      ),
    });
  }
  if (options.canCount) {
    columns.push({
      key: "actions",
      header: "",
      align: "right",
      cell: (line) =>
        line.found === false ? null : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={options.busyLineId === line.id}
            aria-label={L.markMissingFor(line.lpn ?? line.locationCode)}
            onClick={() => options.onMissing(line)}
          >
            {L.markMissing}
          </Button>
        ),
    });
  }
  return columns;
}
