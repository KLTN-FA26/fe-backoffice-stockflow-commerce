"use client";

import Link from "next/link";

import {
  ADMIN_ROUTES,
  PACK_SHIPMENT_STATUS_DISPLAY,
  SHIPMENT_COLUMNS,
  UI_LABELS,
} from "@/constants";
import { useAssignCarrier } from "@/features/shipping/shipment-mutations";
import {
  CELL,
  EmptyCell,
  dateCell,
  numberCell,
  viewColumn,
} from "@/components/shared/column-helpers";
import { StatusDot } from "@/components/shared/StatusDot";

import { CarrierSelect } from "../CarrierSelect";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { ShipmentRow } from "@/features/shipping/types";

const C = SHIPMENT_COLUMNS;
const L = UI_LABELS.shipping.shipments;

/** Hãng của lô: chọn ngay trên dòng khi còn chờ xuất, chưa nằm trên chuyến (BE 409 nếu đã lên chuyến). */
function CarrierCell({ row, editable }: { row: ShipmentRow; editable: boolean }) {
  const assign = useAssignCarrier();
  if (!editable) {
    return row.carrierName ? <span className={CELL.text}>{row.carrierName}</span> : <EmptyCell />;
  }
  return (
    // Click trong ô không được mở chi tiết lô (onRowClick của hàng)
    <div className="w-52" onClick={(event) => event.stopPropagation()}>
      <CarrierSelect
        id={`carrier-${row.shipmentId}`}
        aria-label={`${L.carrierSelectLabel} ${row.code}`}
        value={row.carrierId ?? null}
        currentName={row.carrierName}
        allowNone
        disabled={assign.isPending}
        onChange={(carrierId) => assign.mutate({ shipmentId: row.shipmentId, carrierId })}
      />
    </div>
  );
}

/** Cột bảng lô giao — không có cột mã vận đơn / tracking (hãng là bên thứ ba). */
export function buildShipmentColumns(
  canAssign: (row: ShipmentRow) => boolean,
  open: (row: ShipmentRow) => void,
): ColumnDef<ShipmentRow>[] {
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
      key: C.COD,
      header: UI_LABELS.shipping.field.cod,
      cell: (row) => (
        <span className={CELL.text}>{(row.codAmount ?? 0) > 0 ? L.hasCod : L.noCod}</span>
      ),
    },
    {
      key: C.CARRIER,
      header: UI_LABELS.shipping.field.carrier,
      cell: (row) => <CarrierCell row={row} editable={canAssign(row)} />,
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
