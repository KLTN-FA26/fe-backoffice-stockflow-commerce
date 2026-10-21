"use client";

import Link from "next/link";

import { ADMIN_ROUTES, LOAD_COLUMNS, UI_LABELS } from "@/constants";
import {
  CELL,
  dateCell,
  stackCell,
  statusCell,
  textCell,
  viewColumn,
} from "@/components/shared/column-helpers";

import { LoadProgress } from "../LoadProgress";
import { COLUMN_LABELS } from "./constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { LoadRow } from "@/features/shipping/types";

const C = LOAD_COLUMNS;
const header = (key: string) => COLUMN_LABELS[key] ?? key;

/** Cột bảng chuyến xe — không có cột mã vận đơn / tracking (hãng là bên thứ ba). */
export function buildLoadColumns(navigateToLoading: (row: LoadRow) => void): ColumnDef<LoadRow>[] {
  return [
    {
      key: C.NUMBER,
      header: header(C.NUMBER),
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.shipments.loading(row.loadId)}
          className={`${CELL.code} hover:underline`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.number}
        </Link>
      ),
    },
    // Ô hai dòng: biển số (mono) + loại xe
    stackCell<LoadRow>(
      C.VEHICLE,
      header(C.VEHICLE),
      (row) => row.vehiclePlate,
      (row) => row.vehicleType,
      { mono: true },
    ),
    textCell<LoadRow>(C.CARRIER, header(C.CARRIER), (row) => row.carrierName ?? ""),
    {
      key: C.PROGRESS,
      header: header(C.PROGRESS),
      cell: (row) => <LoadProgress loaded={row.loadedPackages} planned={row.plannedPackages} />,
    },
    statusCell<LoadRow>(C.STATUS, header(C.STATUS), (row) => row.status, "shipment", {
      withIcon: true,
    }),
    dateCell<LoadRow>(C.DISPATCHED_AT, header(C.DISPATCHED_AT), (row) => row.dispatchedAt, {
      withTime: true,
    }),
    {
      ...viewColumn<LoadRow>((row) => ({
        label: `${UI_LABELS.shipping.openLoad} ${row.number}`,
        onOpen: () => navigateToLoading(row),
      })),
      key: C.ACTIONS,
    },
  ];
}
