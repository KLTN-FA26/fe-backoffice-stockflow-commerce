"use client";

import { Pencil, Power } from "lucide-react";

import {
  UI_LABELS,
  VEHICLE_TYPE_COLUMNS as C,
  VEHICLE_TYPE_KIND_LABELS,
  VEHICLE_TYPE_STATUS,
  VEHICLE_TYPE_STATUS_LABELS,
} from "@/constants";

import { formatNumber } from "@/lib/format";

import {
  formatDoorMm,
  formatInnerSizeMetres,
  formatInnerSizeMm,
  formatPayload,
} from "@/features/vehicle-type/selectors";

import { CELL, codeCell, ToneDot, textCell } from "@/components/shared/column-helpers";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { Badge } from "@/components/ui/badge";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { VehicleTypeActions } from "@/features/vehicle-type/lifecycle";
import type { VehicleType } from "@/features/vehicle-type/types";

const L = UI_LABELS.vehicleType;

export interface VehicleTypeColumnHandlers {
  /** Người dùng có thao tác nào trên dòng (quyền cập nhật) — không có thì ẩn hẳn cột thao tác. */
  showActions: boolean;
  actionsOf: (row: VehicleType) => VehicleTypeActions;
  onEdit: (row: VehicleType) => void;
  onToggleStatus: (row: VehicleType) => void;
}

function StatusCell({ status }: { status: VehicleType["status"] }) {
  return (
    <ToneDot
      tone={status === VEHICLE_TYPE_STATUS.ACTIVE ? "positive" : "muted"}
      label={VEHICLE_TYPE_STATUS_LABELS[status]}
    />
  );
}

/** Menu "⋯" cuối dòng: Sửa, Dùng lại / Ngừng dùng (chữ đỏ, cuối) — chỉ khi có quyền cập nhật (`vehicleTypeActions`). */
function RowActions({ row, h }: { row: VehicleType; h: VehicleTypeColumnHandlers }) {
  const actions = h.actionsOf(row);
  const [target] = actions.statusTargets;
  const activating = target === VEHICLE_TYPE_STATUS.ACTIVE;
  return (
    <RowActionsMenu
      label={`Thao tác — ${row.code}`}
      actions={[
        ...(actions.edit ? [{ label: L.edit, icon: Pencil, onSelect: () => h.onEdit(row) }] : []),
        ...(target
          ? [
              {
                label: activating ? L.activate : L.deactivate,
                icon: Power,
                danger: !activating,
                onSelect: () => h.onToggleStatus(row),
              },
            ]
          : []),
      ]}
    />
  );
}

/** Cột bảng loại xe: kích thước hiện mét, mm ở tooltip; loại xe mặc định có nhãn riêng. */
export function buildVehicleTypeColumns(h: VehicleTypeColumnHandlers): ColumnDef<VehicleType>[] {
  const col = L.column;
  const columns: ColumnDef<VehicleType>[] = [
    {
      ...codeCell<VehicleType>(C.CODE, col.code, (row) => row.code),
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          <span className={CELL.code}>{row.code}</span>
          {row.preset && (
            <Badge variant="outline" title={L.presetHint}>
              {L.presetBadge}
            </Badge>
          )}
        </span>
      ),
    },
    textCell<VehicleType>(C.NAME, col.name, (row) => row.name, { color: "primary" }),
    textCell<VehicleType>(C.KIND, col.kind, (row) => VEHICLE_TYPE_KIND_LABELS[row.kind]),
    {
      key: C.INNER_SIZE,
      header: col.innerSize,
      cell: (row) => (
        <span className={CELL.ref} title={formatInnerSizeMm(row)}>
          {formatInnerSizeMetres(row)}
        </span>
      ),
    },
    {
      key: C.PAYLOAD,
      header: col.payload,
      align: "right",
      cell: (row) => <span className={CELL.number}>{formatPayload(row.maxPayloadKg)}</span>,
    },
    {
      key: C.AVAILABLE_COUNT,
      header: col.availableCount,
      align: "right",
      cell: (row) => <span className={CELL.number}>{formatNumber(row.availableCount)}</span>,
    },
    {
      key: C.DOOR,
      header: col.door,
      align: "right",
      cell: (row) => <span className={CELL.number}>{formatDoorMm(row)}</span>,
    },
    {
      key: C.GUSSET,
      header: col.gusset,
      align: "right",
      cell: (row) => <span className={CELL.number}>{`${row.gussetMm} ${L.unitMm}`}</span>,
    },
    { key: C.STATUS, header: col.status, cell: (row) => <StatusCell status={row.status} /> },
    {
      key: C.ACTIONS,
      header: col.actions,
      align: "right",
      className: "w-20",
      cell: (row) => <RowActions row={row} h={h} />,
    },
  ];
  // Chỉ xem: cột thao tác sẽ trống hoàn toàn nên bỏ đi
  return h.showActions ? columns : columns.filter((column) => column.key !== C.ACTIONS);
}
