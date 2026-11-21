"use client";

import { Package, X } from "lucide-react";

import { PUTAWAY_TRIP_LABELS } from "@/constants";
import { holdExpired } from "@/features/putaway/trip-selectors";

import { CELL, EmptyCell, statusCell } from "@/components/shared/column-helpers";
import { DataTable } from "@/components/shared/DataTable";
import { DetailSection } from "@/components/shared/DetailSection";
import { EmptyState } from "@/components/shared/EmptyState";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { PutawayTripCarton } from "@/features/putaway/types";

const L = PUTAWAY_TRIP_LABELS.cart;

function columns(onUnload?: (lpn: string) => void): ColumnDef<PutawayTripCarton>[] {
  return [
    { key: "lpn", header: L.lpn, cell: (c) => <span className={CELL.code}>{c.lpn}</span> },
    {
      key: "item",
      header: L.item,
      cell: (c) => (
        <span className={CELL.ref}>{c.lotNumber ? `${c.sku} · ${c.lotNumber}` : c.sku}</span>
      ),
    },
    {
      key: "bin",
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
    statusCell("status", L.status, (c) => c.status, "move"),
    ...(onUnload
      ? [
          {
            key: "action",
            header: "",
            align: "right" as const,
            cell: (c: PutawayTripCarton) => (
              <div className="flex justify-end">
                <button
                  type="button"
                  aria-label={L.unload(c.lpn)}
                  onClick={() => onUnload(c.lpn)}
                  className={`${CELL.action} hover:text-danger`}
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
 * Bảng thùng trên xe (LOADING) / thùng của chuyến đã kết thúc. `onUnload` chỉ có khi còn bỏ được (LOADING, chủ chuyến).
 * Rỗng → giữ header, nói cách xếp thùng.
 */
export function TripCartTable({
  cartons,
  onUnload,
}: {
  cartons: readonly PutawayTripCarton[];
  onUnload?: (lpn: string) => void;
}) {
  return (
    <DetailSection title={L.title} icon={Package}>
      <DataTable
        data={[...cartons]}
        columns={columns(onUnload)}
        rowKey={(c) => c.putawayTaskId}
        caption={L.title}
        pageSize={20}
        emptyState={<EmptyState className="py-8" title={L.empty} />}
      />
    </DetailSection>
  );
}
