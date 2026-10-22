"use client";

import Link from "next/link";

import { ADMIN_ROUTES, LOAD_COLUMNS, UI_LABELS } from "@/constants";
import {
  CELL,
  dateCell,
  numberCell,
  stackCell,
  statusCell,
  textCell,
  viewColumn,
} from "@/components/shared/column-helpers";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { LoadRow } from "@/features/shipping/types";

const C = LOAD_COLUMNS;
const L = UI_LABELS.shipping;

/** Cột bảng chuyến xe — không có cột mã vận đơn / tracking (hãng là bên thứ ba). */
export function buildLoadColumns(open: (row: LoadRow) => void): ColumnDef<LoadRow>[] {
  return [
    {
      key: C.CODE,
      header: "Mã chuyến",
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.loads.detail(row.loadId)}
          className={`${CELL.code} hover:underline`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.code}
        </Link>
      ),
    },
    textCell<LoadRow>(C.MODE, L.ftl.modeColumn, (row) => L.load.mode[row.mode]),
    // Chuyến nguyên xe: mã kế hoạch + số xe (kế hoạch chưa có trang chi tiết ở PR này → chữ, không link)
    stackCell<LoadRow>(
      C.PLAN,
      L.ftl.planColumn,
      (row) => row.loadPlanCode,
      (row) => (row.vehicleSeq != null ? `${L.ftl.vehicleSeq} ${row.vehicleSeq}` : null),
      { mono: true },
    ),
    textCell<LoadRow>(C.CARRIER, L.field.carrier, (row) => row.carrierName ?? ""),
    // Ô hai dòng: biển số (mono) + tài xế
    stackCell<LoadRow>(
      C.VEHICLE,
      L.field.vehiclePlate,
      (row) => row.vehiclePlate,
      (row) => row.driverName,
      { mono: true },
    ),
    numberCell<LoadRow>(C.SHIPMENTS, L.load.shipmentCount, (row) => row.shipmentCount),
    numberCell<LoadRow>(C.PROGRESS, "Kiện đã lên xe", (row) => row.packageCount),
    statusCell<LoadRow>(C.STATUS, "Trạng thái", (row) => row.status, "shipment", {
      withIcon: true,
    }),
    dateCell<LoadRow>(C.DISPATCHED_AT, L.load.dispatchedAt, (row) => row.dispatchedAt, {
      withTime: true,
    }),
    {
      ...viewColumn<LoadRow>((row) => ({
        label: `${L.loads.openRow} ${row.code}`,
        onOpen: () => open(row),
      })),
      key: C.ACTIONS,
    },
  ];
}
