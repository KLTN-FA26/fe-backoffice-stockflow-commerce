"use client";

import {
  AREA_TYPE_LABELS,
  BIN_TYPE_LABELS,
  WAREHOUSE_LOCATION_COLUMNS as C,
  WAREHOUSE_LOCATION_LABELS as L,
} from "@/constants";
import { formatDate, formatFixed, formatNumber } from "@/lib/format";

import { CopyButton } from "@/components/shared/CopyButton";
import { CELL, EmptyCell, StackText, ViewAction } from "@/components/shared/column-helpers";
import { HiddenDuringCountBadge } from "@/components/shared/HiddenDuringCountBadge";
import { StatusDot } from "@/components/shared/StatusDot";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { LocationRow, LocationStock } from "@/features/warehouse-map/location-list-selectors";

const H = L.column;

/** Thể tích bin m³ ba số lẻ như Bảng sức chứa (docs 06 §4.6). */
const M3_DIGITS = 3;

const kindText = (row: LocationRow) =>
  row.binType ? BIN_TYPE_LABELS[row.binType] : row.areaType ? AREA_TYPE_LABELS[row.areaType] : "";

/** Ô số tồn: chưa đọc được tồn → "—"; đang kiểm kê ẩn số lượng → badge, không bao giờ là số. */
function StockQty({ stock, pick }: { stock: LocationStock | null; pick: "onHand" | "reserved" }) {
  if (!stock) return <EmptyCell />;
  if (stock.hidden) return <HiddenDuringCountBadge />;
  return <span className={CELL.number}>{formatNumber(stock[pick] ?? 0)}</span>;
}

function SkuCell({ stock }: { stock: LocationStock | null }) {
  if (!stock || stock.skus.length === 0) return <EmptyCell />;
  const [first, ...rest] = stock.skus;
  return (
    <span title={stock.skus.join(", ")}>
      <StackText
        mono
        main={first}
        sub={rest.length > 0 ? L.moreSkus(rest.length) : stock.lots.join(", ") || undefined}
      />
    </span>
  );
}

/** Cột danh sách vị trí — bảng chỉ đọc, không có hành động thay đổi vị trí (đổi trạng thái ở bản đồ). */
export function locationColumns(onOpen: (row: LocationRow) => void): ColumnDef<LocationRow>[] {
  return [
    {
      key: C.CODE,
      header: H.code,
      cell: (row) => (
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(row);
            }}
            className={`${CELL.code} hover:underline`}
          >
            {row.locationCode}
          </button>
          <CopyButton value={row.locationCode} />
        </span>
      ),
    },
    {
      key: C.KIND,
      header: H.kind,
      cell: (row) => <StackText main={L.kind[row.kind]} sub={kindText(row)} />,
    },
    {
      key: C.ZONE,
      header: H.zone,
      cell: (row) =>
        row.zoneName ? <span className={CELL.text}>{row.zoneName}</span> : <EmptyCell />,
    },
    {
      key: C.SHELF,
      header: H.shelf,
      cell: (row) =>
        row.shelfCode ? <span className={CELL.ref}>{row.shelfCode}</span> : <EmptyCell />,
    },
    {
      key: C.LEVEL,
      header: H.level,
      align: "right",
      cell: (row) =>
        row.levelIndex === null ? (
          <EmptyCell />
        ) : (
          <span className={CELL.number}>{row.levelIndex}</span>
        ),
    },
    {
      key: C.STATUS,
      header: H.status,
      cell: (row) => (
        <StackText
          main={<StatusDot domain="location" status={row.status} />}
          sub={row.usable ? undefined : L.notUsable}
        />
      ),
    },
    { key: C.SKUS, header: H.skus, cell: (row) => <SkuCell stock={row.stock} /> },
    {
      key: C.ON_HAND,
      header: H.onHand,
      align: "right",
      cell: (row) => <StockQty stock={row.stock} pick="onHand" />,
    },
    {
      key: C.RESERVED,
      header: H.reserved,
      align: "right",
      cell: (row) => <StockQty stock={row.stock} pick="reserved" />,
    },
    {
      key: C.EXPIRY,
      header: H.expiry,
      cell: (row) =>
        row.stock?.nearestExpiry ? (
          <span className={CELL.date}>{formatDate(row.stock.nearestExpiry)}</span>
        ) : (
          <EmptyCell />
        ),
    },
    {
      key: C.USES,
      header: H.uses,
      cell: (row) => {
        const uses = [row.pickable && L.pickable, row.putawayTarget && L.putawayTarget].filter(
          Boolean,
        );
        return uses.length > 0 ? (
          <span className={CELL.text}>{uses.join(" · ")}</span>
        ) : (
          <EmptyCell />
        );
      },
    },
    {
      key: C.CAPACITY,
      header: H.capacity,
      align: "right",
      cell: (row) =>
        row.capacityM3 === null ? (
          <span title={row.kind === "area" ? L.noCapacity : undefined}>
            <EmptyCell />
          </span>
        ) : (
          <span className={CELL.number}>{formatFixed(row.capacityM3, M3_DIGITS)}</span>
        ),
    },
    {
      key: C.MAX_WEIGHT,
      header: H.maxWeight,
      align: "right",
      cell: (row) =>
        row.maxWeightKg === null ? (
          <EmptyCell />
        ) : (
          <span className={CELL.number}>{formatNumber(row.maxWeightKg)}</span>
        ),
    },
    {
      key: C.ACTIONS,
      header: H.actions,
      align: "right",
      sticky: "right",
      cell: (row) => (
        <ViewAction label={L.openDetail(row.locationCode)} onOpen={() => onOpen(row)} />
      ),
    },
  ];
}
