"use client";

import {
  LOAD_PLAN_COLUMNS as C,
  LOAD_PLAN_MODE_LABELS,
  LOAD_PLAN_STATUS_LABELS,
  UI_LABELS,
} from "@/constants";
import { formatNumber } from "@/lib/format";
import { loadPlanStatusTone } from "@/features/load-planning/plan-selectors";
import { CELL, dateCell, ToneDot, textCell } from "@/components/shared/column-helpers";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { PlanRow } from "@/features/load-planning/plan-types";

const col = UI_LABELS.loadPlan.column;

const numberColumn = (
  key: string,
  header: string,
  pick: (row: PlanRow) => number,
): ColumnDef<PlanRow> => ({
  key,
  header,
  align: "right",
  cell: (row) => <span className={CELL.number}>{formatNumber(pick(row))}</span>,
});

/** Cột bảng kế hoạch (BE `LoadPlans.PlanRow`): mã mono, trạng thái chấm màu, số liệu căn phải. */
export function buildLoadPlanColumns(): ColumnDef<PlanRow>[] {
  return [
    {
      key: C.CODE,
      header: col.code,
      cell: (row) => <span className={CELL.code}>{row.code}</span>,
    },
    {
      key: C.STATUS,
      header: col.status,
      cell: (row) => (
        <ToneDot
          tone={loadPlanStatusTone(row.status)}
          label={LOAD_PLAN_STATUS_LABELS[row.status]}
        />
      ),
    },
    textCell<PlanRow>(C.MODE, col.mode, (row) => LOAD_PLAN_MODE_LABELS[row.selectionMode]),
    numberColumn(C.SHIPMENTS, col.shipments, (row) => row.shipmentCount),
    numberColumn(C.VEHICLES, col.vehicles, (row) => row.vehicleCount),
    numberColumn(C.PACKAGES, col.packages, (row) => row.packageCount),
    numberColumn(C.UNPLACED, col.unplaced, (row) => row.unplacedCount),
    dateCell<PlanRow>(C.CREATED_AT, col.createdAt, (row) => row.createdAt, { withTime: true }),
  ];
}
