"use client";

import { INVENTORY_LABELS } from "@/constants/inventory";

import { Alert } from "@/components/shared/Alert";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { useStockLevels } from "../queries";
import { InventoryError } from "./InventoryFeedback";
import { StockLevelsTable } from "./StockLevelsTable";
import { WarehouseInventorySection } from "./WarehouseInventorySection";

/**
 * Stock of one SKU (mounted only with inventory-stock-items:READ). Levels come back complete for
 * every warehouse in scope — the backend does not page them, so neither does this table.
 */
export function StockOverviewSection({
  sku,
  canResolveWarehouse,
  warehouseCode,
  onSelectWarehouse,
}: {
  sku: string;
  /** warehouse-warehouses:READ held too: only then is the warehouse resolved and drilled into. */
  canResolveWarehouse: boolean;
  warehouseCode: string | null;
  onSelectWarehouse: (code: string) => void;
}) {
  const levels = useStockLevels(sku);

  return (
    <section
      aria-labelledby="inventory-stock-levels"
      className="border-border-default bg-bg-surface space-y-[var(--card-pad)] rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow)"
    >
      <h2 id="inventory-stock-levels" className="text-ink-primary font-semibold">
        {INVENTORY_LABELS.stockLevelsTitle}
      </h2>
      {levels.isLoading ? (
        <PageSkeleton variant="list" />
      ) : levels.isError ? (
        <InventoryError error={levels.error} retry={() => void levels.refetch()} />
      ) : levels.data?.length ? (
        <StockLevelsTable
          levels={levels.data}
          selectedCode={warehouseCode}
          onSelect={onSelectWarehouse}
        />
      ) : (
        <EmptyState
          title={INVENTORY_LABELS.noStockLevels}
          description={INVENTORY_LABELS.noStockLevelsDescription}
        />
      )}
      {warehouseCode &&
        (canResolveWarehouse ? (
          <WarehouseInventorySection key={warehouseCode} sku={sku} warehouseCode={warehouseCode} />
        ) : (
          // No directory permission: the id cannot be known, so no directory, stock-item or ATP read.
          <div role="alert">
            <Alert
              tone="warning"
              title={`${INVENTORY_LABELS.directoryForbidden}: ${warehouseCode}`}
            >
              {INVENTORY_LABELS.warehouseDetailUnavailable}
            </Alert>
          </div>
        ))}
    </section>
  );
}
