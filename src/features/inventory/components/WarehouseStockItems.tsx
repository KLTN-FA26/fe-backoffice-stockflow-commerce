"use client";

import { useState } from "react";

import { INVENTORY_LABELS } from "@/constants/inventory";
import { PAGE_SIZE } from "@/constants/table";

import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useWarehouseStockItems } from "../queries";
import { InventoryError } from "./InventoryFeedback";
import { InventoryPager } from "./InventoryPager";

import type { WarehouseOption } from "@/lib/references/warehouse-options";

// Server-side expiry order (StockBrowsingImpl whitelist). Rows are shown in the order received;
// where rows without an expiry date fall is the database's choice, not a backend guarantee.
const EXPIRY_FIRST = { field: "expiryDate", direction: "asc" } as const;
const { missing } = INVENTORY_LABELS;

/**
 * Every stock row of the SKU in one warehouse, any status, paged by the backend. The parent keys
 * this section by warehouse and SKU, so choosing another one starts again at page 1.
 */
export function WarehouseStockItems({
  sku,
  warehouse,
}: {
  sku: string;
  warehouse: WarehouseOption;
}) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(PAGE_SIZE.md);
  const query = useWarehouseStockItems({
    warehouseId: warehouse.warehouseId,
    sku,
    page: page - 1,
    size,
    sort: EXPIRY_FIRST,
  });

  return (
    <section
      aria-labelledby="inventory-stock-items"
      aria-busy={query.isFetching}
      className="border-border-default rounded-[var(--r-sm)] border"
    >
      <div className="p-[var(--card-pad)]">
        <h3 id="inventory-stock-items" className="text-ink-primary font-semibold">
          {INVENTORY_LABELS.stockItemsTitle} · <span className="font-mono">{warehouse.code}</span>
        </h3>
        <p className="text-ink-tertiary text-xs">{INVENTORY_LABELS.stockItemsSort}</p>
      </div>
      {query.isLoading ? (
        <PageSkeleton variant="list" />
      ) : query.isError ? (
        <InventoryError error={query.error} retry={() => void query.refetch()} />
      ) : query.data ? (
        <>
          {query.data.items.length ? (
            <Table>
              <TableCaption className="sr-only">{INVENTORY_LABELS.stockItemsTitle}</TableCaption>
              <TableHeader className="bg-bg-subtle">
                <TableRow>
                  <TableHead scope="col">{INVENTORY_LABELS.location}</TableHead>
                  <TableHead scope="col">{INVENTORY_LABELS.lot}</TableHead>
                  <TableHead scope="col">{INVENTORY_LABELS.expiryDate}</TableHead>
                  <TableHead scope="col">{INVENTORY_LABELS.status}</TableHead>
                  <TableHead scope="col" className="text-right">
                    {INVENTORY_LABELS.onHand}
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    {INVENTORY_LABELS.reserved}
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    {INVENTORY_LABELS.available}
                  </TableHead>
                  <TableHead scope="col">{INVENTORY_LABELS.receivedAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((item) => (
                  <TableRow key={item.stockItemId}>
                    <TableCell className="font-mono">{item.locationCode}</TableCell>
                    <TableCell className="font-mono">{item.lotNumber ?? missing}</TableCell>
                    <TableCell className="tabular-nums">
                      {item.expiryDate ? formatDate(item.expiryDate) : missing}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.status}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatNumber(item.onHand)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatNumber(item.reserved)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatNumber(item.available)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {item.receivedAt ? formatDateTime(item.receivedAt) : missing}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title={INVENTORY_LABELS.noStockItems} />
          )}
          <InventoryPager
            id="inventory-stock-items-page-size"
            data={query.data}
            pending={query.isFetching}
            size={size}
            setSize={(next) => {
              setSize(next);
              setPage(1);
            }}
            setPage={setPage}
          />
        </>
      ) : null}
    </section>
  );
}
