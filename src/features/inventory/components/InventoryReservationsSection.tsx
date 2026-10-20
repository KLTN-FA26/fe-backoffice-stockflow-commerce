"use client";

import { useState } from "react";

import { INVENTORY_LABELS } from "@/constants/inventory";
import { PAGE_SIZE } from "@/constants/table";

import { useWarehouseDirectory } from "@/lib/references/warehouse-options";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { useReservations } from "../queries";
import { selectWarehouseByCode } from "../selectors";
import { InventoryError } from "./InventoryFeedback";
import { InventoryPager } from "./InventoryPager";
import { ReservationsTable } from "./ReservationsTable";

/**
 * Holds on one SKU (mounted only with inventory-reservations:READ), newest first as the backend
 * orders them. Needs no stock permission: a reservation-only user filters by SKU alone. When a
 * warehouse is open in the stock section, the user may narrow to it — off by default.
 */
export function InventoryReservationsSection({
  sku,
  warehouseCode,
}: {
  sku: string;
  warehouseCode: string | null;
}) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(PAGE_SIZE.md);
  const [onlyWarehouse, setOnlyWarehouse] = useState(false);
  // A selected display code is not an identity until the permitted directory resolves it.
  const directory = useWarehouseDirectory(warehouseCode !== null);
  const resolvedWarehouse =
    warehouseCode && directory.data && !directory.isError
      ? selectWarehouseByCode(directory.data, warehouseCode)
      : null;
  const warehouse = onlyWarehouse && resolvedWarehouse ? resolvedWarehouse.code : undefined;
  // Another warehouse opened while narrowed is a different filter: start again at page 1.
  const [pagedFor, setPagedFor] = useState(warehouse);
  if (pagedFor !== warehouse) {
    setPagedFor(warehouse);
    setPage(1);
  }
  const query = useReservations({ sku, warehouse, page: page - 1, size });

  return (
    <section
      aria-labelledby="inventory-reservations"
      aria-busy={query.isFetching}
      className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border"
    >
      <div className="flex flex-wrap items-center justify-between gap-[var(--el-gap)] p-[var(--card-pad)]">
        <h2 id="inventory-reservations" className="text-ink-primary font-semibold">
          {INVENTORY_LABELS.reservationsTitle}
        </h2>
        {resolvedWarehouse && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="inventory-reservations-warehouse"
              checked={onlyWarehouse}
              onCheckedChange={(checked) => {
                setOnlyWarehouse(checked === true);
                setPage(1);
              }}
            />
            <Label htmlFor="inventory-reservations-warehouse">
              {INVENTORY_LABELS.onlySelectedWarehouse} (
              <span className="font-mono">{warehouseCode}</span>)
            </Label>
          </div>
        )}
      </div>
      {query.isLoading ? (
        <PageSkeleton variant="list" />
      ) : query.isError ? (
        <InventoryError error={query.error} retry={() => void query.refetch()} />
      ) : query.data ? (
        <>
          {query.data.items.length ? (
            <ReservationsTable items={query.data.items} />
          ) : (
            <EmptyState title={INVENTORY_LABELS.noReservations} />
          )}
          <InventoryPager
            id="inventory-reservations-page-size"
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
