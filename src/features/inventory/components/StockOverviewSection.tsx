"use client";

import { INVENTORY_LABELS } from "@/constants/inventory";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { useStockLevels } from "../queries";
import { InventoryError } from "./InventoryFeedback";
import { LowStockAlerts } from "./StockAlerts";
import { StockLevelsTable } from "./StockLevelsTable";
import { WarehouseInventorySection } from "./WarehouseInventorySection";

/**
 * Stock of one SKU (mounted only with inventory-stock-items:READ). Levels come back complete for
 * every warehouse in scope — the backend does not page them, so neither does this table.
 */
export function StockOverviewSection({
  sku,
  showAlerts,
  warehouseCode,
  onSelectWarehouse,
}: {
  sku: string;
  /** alert READ held as well: without it the page shows "unavailable", never "no alert". */
  showAlerts: boolean;
  warehouseCode: string | null;
  onSelectWarehouse: (code: string) => void;
}) {
  const levels = useStockLevels(sku);

  return (
    <section
      aria-labelledby="inventory-stock-levels"
      className="border-border-default bg-bg-surface space-y-[var(--card-pad)] rounded-[var(--r-sm)] border p-[var(--card-pad)]"
    >
      <h2 id="inventory-stock-levels" className="text-ink-primary font-semibold">
        {INVENTORY_LABELS.stockLevelsTitle}
      </h2>
      {showAlerts ? (
        <LowStockAlerts sku={sku} />
      ) : (
        <p className="text-ink-tertiary text-sm">{INVENTORY_LABELS.alertsUnavailable}</p>
      )}
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
      {warehouseCode && (
        <WarehouseInventorySection
          key={warehouseCode}
          sku={sku}
          warehouseCode={warehouseCode}
          showAlerts={showAlerts}
        />
      )}
    </section>
  );
}
