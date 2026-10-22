"use client";

import { Pencil, Power } from "lucide-react";

import {
  UI_LABELS,
  VEHICLE_TYPE_COLUMNS as C,
  VEHICLE_TYPE_KIND_LABELS,
  VEHICLE_TYPE_STATUS,
  VEHICLE_TYPE_STATUS_LABELS,
} from "@/constants";
import { CELL, codeCell, ToneDot, textCell } from "@/components/shared/column-helpers";
import { Badge } from "@/components/ui/badge";
import {
  formatInnerSizeMetres,
  formatInnerSizeMm,
  formatPayload,
} from "@/features/vehicle-type/selectors";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { VehicleTypeActions } from "@/features/vehicle-type/lifecycle";
import type { VehicleType } from "@/features/vehicle-type/types";

const L = UI_LABELS.vehicleType;

export interface VehicleTypeColumnHandlers {
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

/** Nút sửa / ngừng dùng cuối dòng — chỉ hiện khi có quyền cập nhật (`vehicleTypeActions`). */
function RowActions({ row, h }: { row: VehicleType; h: VehicleTypeColumnHandlers }) {
  const actions = h.actionsOf(row);
  const [target] = actions.statusTargets;
  const toggleLabel = target === VEHICLE_TYPE_STATUS.ACTIVE ? L.activate : L.deactivate;
  return (
    <div className="flex items-center justify-end gap-1.5">
      {actions.edit && (
        <button
          type="button"
          aria-label={`${L.edit} ${row.code}`}
          onClick={(event) => {
            event.stopPropagation();
            h.onEdit(row);
          }}
          className={CELL.action}
        >
          <Pencil className="size-3.5" />
        </button>
      )}
      {target && (
        <button
          type="button"
          aria-label={`${toggleLabel} ${row.code}`}
          title={toggleLabel}
          onClick={(event) => {
            event.stopPropagation();
            h.onToggleStatus(row);
          }}
          className={CELL.action}
        >
          <Power className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Cột bảng loại xe: kích thước hiện mét, mm ở tooltip; loại xe mặc định có nhãn riêng. */
export function buildVehicleTypeColumns(h: VehicleTypeColumnHandlers): ColumnDef<VehicleType>[] {
  const col = L.column;
  return [
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
      cell: (row) => (
        <span className={CELL.number}>{row.availableCount.toLocaleString("vi-VN")}</span>
      ),
    },
    {
      key: C.GUSSET,
      header: col.gusset,
      align: "right",
      cell: (row) => <span className={CELL.number}>{`${row.gussetMm} ${L.unitMm}`}</span>,
    },
    { key: C.STATUS, header: col.status, cell: (row) => <StatusCell status={row.status} /> },
    { key: C.ACTIONS, header: "", cell: (row) => <RowActions row={row} h={h} /> },
  ];
}
