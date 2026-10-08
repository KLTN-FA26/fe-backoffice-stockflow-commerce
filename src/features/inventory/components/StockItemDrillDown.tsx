"use client";

import { useMemo } from "react";

import { numberCell, subCodeCell, textCell } from "@/components/shared/column-helpers";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format/date";

import { INVENTORY_COPY } from "../constants";
import { useInventoryStockItems } from "../queries";
import { orderStockItemsByExpiry } from "../stock-items";
import { InventoryHighlights } from "./InventoryHighlights";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { InventoryService } from "../service";
import type { StockItemRow, StockLevelRow } from "../types";

const columns: ColumnDef<StockItemRow>[] = [
  subCodeCell("sku", "SKU", (row) => row.sku),
  textCell("location", "Vị trí", (row) => row.location),
  textCell("lot", "Lô", (row) => row.lot ?? INVENTORY_COPY.noLot),
  {
    key: "expiry",
    header: "Hạn dùng",
    cell: (row) => (
      <span className="text-ink-secondary text-[0.8125rem] tabular-nums">
        {row.expiry ? formatDate(row.expiry) : INVENTORY_COPY.noExpiry}
      </span>
    ),
  },
  numberCell("onHand", "Tồn thực tế", (row) => row.onHand),
  numberCell("reserved", "Đã giữ", (row) => row.reserved),
  numberCell("available", "Khả dụng", (row) => row.available),
  textCell("status", "Trạng thái", (row) => row.status ?? INVENTORY_COPY.unknownStatus),
  textCell("condition", "Tình trạng", (row) => row.condition ?? INVENTORY_COPY.unknownCondition),
  {
    key: "highlights",
    header: "Lưu ý",
    cell: (row) => (
      <InventoryHighlights highlights={[row.nearExpiryHighlight, row.availabilityHighlight]} />
    ),
  },
];

export function StockItemDrillDown({
  selected,
  service,
}: {
  selected: StockLevelRow | null;
  service: InventoryService;
}) {
  const query = useInventoryStockItems(service, selected?.sku, selected?.warehouse.code);
  const ordered = useMemo(() => orderStockItemsByExpiry(query.data ?? []), [query.data]);

  return (
    <section
      aria-labelledby="inventory-stock-items"
      className="border-border-default bg-bg-surface space-y-3 rounded-[var(--card-radius)] border p-[var(--card-pad)]"
    >
      <div>
        <h2 id="inventory-stock-items" className="text-ink-primary font-semibold">
          Stock Items
        </h2>
        {selected && (
          <p className="text-ink-secondary text-sm">
            <span className="font-mono">{selected.sku}</span> ·{" "}
            {selected.warehouse.name ?? selected.warehouse.code}
          </p>
        )}
        <p className="text-ink-tertiary text-xs">{INVENTORY_COPY.fefoDisplayNote}</p>
      </div>
      {!selected ? (
        <EmptyState title={INVENTORY_COPY.selectStockLevel} />
      ) : query.isPending ? (
        <PageSkeleton variant="list" />
      ) : query.isError ? (
        <EmptyState
          title={INVENTORY_COPY.stockItemError}
          action={<Button onClick={() => void query.refetch()}>{INVENTORY_COPY.retry}</Button>}
        />
      ) : ordered.length === 0 ? (
        <EmptyState title={INVENTORY_COPY.noStockItems} />
      ) : (
        <div className="overflow-x-auto">
          <DataTable data={ordered} columns={columns} rowKey={(row) => row.id} />
        </div>
      )}
    </section>
  );
}
