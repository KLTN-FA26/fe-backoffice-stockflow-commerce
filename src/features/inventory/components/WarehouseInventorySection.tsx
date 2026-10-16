"use client";

import { INVENTORY_LABELS } from "@/constants/inventory";

import { useWarehouseDirectory } from "@/lib/references/warehouse-options";

import { Alert } from "@/components/shared/Alert";
import { Skeleton } from "@/components/shared/Skeleton";

import { selectWarehouseByCode } from "../selectors";
import { AtpSummary } from "./AtpSummary";
import { ExpiryAlerts } from "./StockAlerts";
import { WarehouseStockItems } from "./WarehouseStockItems";

/**
 * Stock levels name a warehouse by its code; the stock-item read needs its id. The id comes only
 * from the warehouse directory — never guessed from the code. Until the code is matched there,
 * neither the stock-item nor the ATP read is sent.
 */
export function WarehouseInventorySection({
  sku,
  warehouseCode,
  showAlerts,
}: {
  sku: string;
  warehouseCode: string;
  showAlerts: boolean;
}) {
  const directory = useWarehouseDirectory();
  const warehouse = directory.data ? selectWarehouseByCode(directory.data, warehouseCode) : null;

  if (directory.isLoading) {
    return (
      <div role="status" aria-label={INVENTORY_LABELS.directoryLoading}>
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (!warehouse) {
    return (
      <div role="alert">
        <Alert
          tone="warning"
          title={
            directory.isError
              ? INVENTORY_LABELS.directoryUnavailable
              : `${INVENTORY_LABELS.warehouseUnresolved}: ${warehouseCode}`
          }
        >
          {INVENTORY_LABELS.warehouseDetailUnavailable}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-[var(--card-pad)]">
      <AtpSummary sku={sku} warehouseCode={warehouse.code} />
      {showAlerts && <ExpiryAlerts sku={sku} warehouseId={warehouse.warehouseId} />}
      <WarehouseStockItems sku={sku} warehouse={warehouse} />
    </div>
  );
}
