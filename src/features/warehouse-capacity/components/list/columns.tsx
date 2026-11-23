"use client";

import { ADMIN_ROUTES, UI_LABELS, WAREHOUSE_CAPACITY_COLUMNS as C } from "@/constants";

import { factorPercentText } from "@/features/warehouse-capacity/selectors";

import { CELL, viewColumn } from "@/components/shared/column-helpers";

import { formatShare, UsageBar, VolumeText } from "../parts";

import type { ReactNode } from "react";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { CapacityBoard } from "@/features/warehouse-capacity/types";

const L = UI_LABELS.warehouseCapacity;
const col = L.column;

const byNumber = (get: (row: CapacityBoard) => number) => (a: CapacityBoard, b: CapacityBoard) =>
  get(a) - get(b);

/** Ô số m³ (+ dòng phụ tuỳ chọn) căn phải — mọi cột số của bảng. */
function volumeColumn(
  key: string,
  header: string,
  get: (row: CapacityBoard) => number,
  opts: { sub?: (row: CapacityBoard) => ReactNode; muted?: boolean; title?: string } = {},
): ColumnDef<CapacityBoard> {
  return {
    key,
    header,
    align: "right",
    sortable: true,
    compare: byNumber(get),
    headerClassName: "whitespace-nowrap",
    cell: (row) => (
      <div className="flex flex-col items-end gap-0.5" title={opts.title}>
        <VolumeText m3={get(row)} muted={opts.muted} />
        {opts.sub?.(row)}
      </div>
    ),
  };
}

/**
 * Cột Bảng sức chứa — một dòng mỗi kho (docs 06 §4.6 bước 3). Số căn phải, mono; còn trống âm tô đỏ (BR-21);
 * Sắp xuất chỉ tham khảo nên chữ nhạt. Bấm dòng / nút xem → chi tiết theo zone / kệ / khu.
 */
export function buildCapacityColumns(): ColumnDef<CapacityBoard>[] {
  return [
    {
      key: C.WAREHOUSE,
      header: col.warehouse,
      sortable: true,
      compare: (a, b) => a.warehouseCode.localeCompare(b.warehouseCode),
      cell: (row) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={CELL.code}>{row.warehouseCode}</span>
          <span className={CELL.sub}>{row.warehouseName}</span>
        </div>
      ),
    },
    volumeColumn(C.CAPACITY, col.capacity, (row) => row.capacityM3, {
      title: L.hint.capacity,
      sub: (row) => (
        <span className={CELL.sub}>
          {L.factor} {factorPercentText(row.utilizationFactor)}%
        </span>
      ),
    }),
    volumeColumn(C.OCCUPIED, col.occupied, (row) => row.occupiedM3, {
      title: L.hint.occupied,
      sub: (row) => (
        <UsageBar percent={row.occupiedPercent} label={`${col.usage} ${row.warehouseCode}`} />
      ),
    }),
    volumeColumn(C.INCOMING, col.incoming, (row) => row.incomingM3, { title: L.hint.incoming }),
    volumeColumn(C.PROJECTED_FREE, col.projectedFree, (row) => row.projectedFreeM3, {
      title: L.hint.projectedFree,
      sub: (row) =>
        row.projectedFreePercent === null || row.projectedFreePercent === undefined ? null : (
          <span className={row.projectedFreePercent < 0 ? "text-danger text-xs" : CELL.sub}>
            {formatShare(row.projectedFreePercent)}
          </span>
        ),
    }),
    volumeColumn(C.PENDING, col.pending, (row) => row.pendingM3, { title: L.hint.pending }),
    volumeColumn(C.FREE_IF_ALL_APPROVED, col.freeIfAllApproved, (row) => row.freeIfAllApprovedM3, {
      title: L.hint.freeIfAllApproved,
    }),
    volumeColumn(C.OUTGOING, col.outgoing, (row) => row.outgoingM3, {
      title: L.hint.outgoing,
      muted: true,
    }),
    viewColumn(
      (row) => ({
        label: `${L.detailTitle} ${row.warehouseCode}`,
        href: ADMIN_ROUTES.warehouseCapacity.detail(row.warehouseCode),
      }),
      C.ACTIONS,
    ),
  ];
}
