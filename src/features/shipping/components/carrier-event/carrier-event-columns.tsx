"use client";

import Link from "next/link";

import { ADMIN_ROUTES, CARRIER_EVENT_COLUMNS, UI_LABELS } from "@/constants";
import { isErrorListResult } from "@/features/shipping/carrier-event-lifecycle";
import { formatDateTime } from "@/lib/format/date";
import {
  CELL,
  EmptyCell,
  StackText,
  ToneDot,
  textCell,
  viewColumn,
} from "@/components/shared/column-helpers";

import { EventResult } from "./EventResult";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { CarrierEventRow } from "@/features/shipping/carrier-event-types";

const C = CARRIER_EVENT_COLUMNS;
const E = UI_LABELS.shipping.carrierEvents;

function ref(code: string | null | undefined, href: string | null) {
  if (!code) return <EmptyCell />;
  if (!href) return <span className={CELL.ref}>{code}</span>;
  return (
    <Link
      href={href}
      className={`${CELL.code} hover:underline`}
      onClick={(event) => event.stopPropagation()}
    >
      {code}
    </Link>
  );
}

function resolutionCell(row: CarrierEventRow) {
  if (row.resolvedAt) {
    return <StackText main={row.resolvedByName} sub={formatDateTime(row.resolvedAt)} />;
  }
  if (isErrorListResult(row.result))
    return <ToneDot tone="warning" label={E.filter.handlingOpen} />;
  return <EmptyCell />;
}

/**
 * Cột nhật ký sự kiện: nhận lúc (kèm lúc hãng báo), hãng + nguồn, loại sự kiện, chuyến, lô giao, kết quả, ghi chú của hệ
 * thống, người xử lý. Mã chuyến / lô giao chỉ là liên kết khi người dùng xem được trang giao hàng (`canLink`).
 */
export function buildCarrierEventColumns(
  open: (row: CarrierEventRow) => void,
  canLink: boolean,
  /** Tên hãng của sự kiện nếu tra được; không thì cột chỉ còn mã hãng. */
  carrierName: (row: CarrierEventRow) => string | undefined = () => undefined,
): ColumnDef<CarrierEventRow>[] {
  return [
    {
      key: C.RECEIVED,
      header: E.column.received,
      cell: (row) => (
        <StackText
          main={formatDateTime(row.receivedAt)}
          sub={
            row.carrierReportedAt ? E.column.reported(formatDateTime(row.carrierReportedAt)) : null
          }
        />
      ),
    },
    {
      key: C.CARRIER,
      header: E.column.carrier,
      cell: (row) => {
        const name = carrierName(row);
        return (
          <span title={row.carrierCode ?? undefined}>
            <StackText main={name ?? row.carrierCode} sub={E.source[row.source]} mono={!name} />
          </span>
        );
      },
    },
    textCell<CarrierEventRow>(C.KIND, E.column.kind, (row) => (row.kind ? E.kind[row.kind] : "")),
    {
      key: C.LOAD,
      header: E.column.loadShipment,
      cell: (row) => (
        <StackText
          main={ref(
            row.loadCode,
            canLink && row.loadId ? ADMIN_ROUTES.loads.detail(row.loadId) : null,
          )}
          sub={
            row.shipmentCode
              ? ref(
                  row.shipmentCode,
                  canLink && row.shipmentId ? ADMIN_ROUTES.shipments.detail(row.shipmentId) : null,
                )
              : null
          }
        />
      ),
    },
    {
      key: C.RESULT,
      header: E.column.result,
      cell: (row) => <EventResult result={row.result} />,
    },
    { key: C.RESOLUTION, header: E.column.resolution, cell: resolutionCell },
    {
      ...viewColumn<CarrierEventRow>((row) => ({
        label: `${E.openRow} ${row.carrierCode ?? ""} ${formatDateTime(row.receivedAt)}`.replace(
          /\s+/g,
          " ",
        ),
        onOpen: () => open(row),
      })),
      key: C.ACTIONS,
    },
  ];
}
