"use client";

import { Package, X } from "lucide-react";

import { PUTAWAY_LIMITS, PUTAWAY_TRIP_CART_COLUMNS as C, PUTAWAY_TRIP_LABELS } from "@/constants";
import { holdExpired } from "@/features/putaway/trip-selectors";

import { CELL, EmptyCell, statusCell } from "@/components/shared/column-helpers";
import { DataTable } from "@/components/shared/DataTable";
import { DetailSection } from "@/components/shared/DetailSection";
import { EmptyState } from "@/components/shared/EmptyState";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { PutawayTripCarton } from "@/features/putaway/types";

const L = PUTAWAY_TRIP_LABELS.cart;

function columns(
  onUnload: ((lpn: string) => void) | undefined,
  unloadPending: boolean,
): ColumnDef<PutawayTripCarton>[] {
  return [
    { key: C.LPN, header: L.lpn, cell: (c) => <span className={CELL.code}>{c.lpn}</span> },
    {
      key: C.ITEM,
      header: L.item,
      cell: (c) => (
        <span className={CELL.ref}>{c.lotNumber ? `${c.sku} · ${c.lotNumber}` : c.sku}</span>
      ),
    },
    {
      key: C.BIN,
      header: L.bin,
      cell: (c) =>
        c.assignedLocationCode ? (
          <span className="flex flex-col">
            <span className={CELL.ref}>{c.assignedLocationCode}</span>
            {holdExpired(c) && <span className="text-warning text-xs">{L.holdExpired}</span>}
          </span>
        ) : (
          <EmptyCell />
        ),
    },
    statusCell(C.STATUS, L.status, (c) => c.status, "move"),
    ...(onUnload
      ? [
          {
            key: C.ACTION,
            header: "",
            align: "right" as const,
            cell: (c: PutawayTripCarton) => (
              <div className="flex justify-end">
                <button
                  type="button"
                  aria-label={L.unload(c.lpn)}
                  disabled={unloadPending}
                  onClick={() => onUnload(c.lpn)}
                  className={`${CELL.action} hover:text-danger disabled:opacity-50`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];
}

/**
 * Bảng thùng trên xe (LOADING) / thùng của chuyến đã kết thúc. `onUnload` chỉ có khi còn bỏ được (LOADING, chủ chuyến);
 * `unloadPending` khoá nút bỏ khi đang gửi để không bấm đúp. Rỗng → giữ header, nói cách xếp thùng.
 */
export function TripCartTable({
  cartons,
  onUnload,
  unloadPending = false,
}: {
  cartons: readonly PutawayTripCarton[];
  onUnload?: (lpn: string) => void;
  unloadPending?: boolean;
}) {
  return (
    <DetailSection title={L.title} icon={Package}>
      <DataTable
        data={[...cartons]}
        columns={columns(onUnload, unloadPending)}
        rowKey={(c) => c.putawayTaskId}
        caption={L.title}
        pageSize={PUTAWAY_LIMITS.cartPageSize}
        emptyState={<EmptyState className="py-8" title={L.empty} />}
      />
    </DetailSection>
  );
}
