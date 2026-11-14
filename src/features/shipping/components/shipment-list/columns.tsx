"use client";

import Link from "next/link";

import {
  ADMIN_ROUTES,
  PACK_SHIPMENT_STATUS_DISPLAY,
  SHIPMENT_COLUMNS,
  UI_LABELS,
} from "@/constants";
import {
  CELL,
  EmptyCell,
  dateCell,
  numberCell,
  viewColumn,
} from "@/components/shared/column-helpers";
import { StatusDot } from "@/components/shared/StatusDot";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { ShipmentRow } from "@/features/shipping/types";

const C = SHIPMENT_COLUMNS;
const L = UI_LABELS.shipping.shipments;

/** Cột bảng lô giao — hãng là hãng của xe chở lô (có sau khi đặt xe); mã vận đơn nằm ở chuyến. */
export function buildShipmentColumns(open: (row: ShipmentRow) => void): ColumnDef<ShipmentRow>[] {
  return [
    {
      key: C.CODE,
      header: "Mã lô giao",
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.shipments.detail(row.shipmentId)}
          className={`${CELL.code} hover:underline`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.code}
        </Link>
      ),
    },
    {
      key: C.ORDER,
      header: "Đơn hàng",
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.orders.detail(row.orderId)}
          className={`${CELL.ref} hover:underline`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.orderNumber ?? row.orderId}
        </Link>
      ),
    },
    numberCell<ShipmentRow>(C.PACKAGES, "Số kiện", (row) => row.packageCount),
    {
      key: C.CARRIER,
      header: UI_LABELS.shipping.field.carrier,
      cell: (row) =>
        row.carrierName ? <span className={CELL.text}>{row.carrierName}</span> : <EmptyCell />,
    },
    {
      key: C.LOAD,
      header: "Chuyến",
      cell: (row) =>
        row.loadId ? (
          <Link
            href={ADMIN_ROUTES.loads.detail(row.loadId)}
            className={`${CELL.ref} hover:underline`}
            onClick={(event) => event.stopPropagation()}
          >
            {row.loadCode ?? row.loadId}
          </Link>
        ) : (
          <EmptyCell />
        ),
    },
    {
      key: C.STATUS,
      header: "Trạng thái",
      cell: (row) => (
        <StatusDot domain="shipment" status={PACK_SHIPMENT_STATUS_DISPLAY[row.status]} />
      ),
    },
    dateCell<ShipmentRow>(C.READY_AT, "Sẵn sàng xuất", (row) => row.readyAt, { withTime: true }),
    {
      ...viewColumn<ShipmentRow>((row) => ({
        label: `${L.title} ${row.code}`,
        onOpen: () => open(row),
      })),
      key: C.ACTIONS,
    },
  ];
}
