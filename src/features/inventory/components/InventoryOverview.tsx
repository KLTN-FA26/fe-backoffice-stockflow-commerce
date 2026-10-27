"use client";

import { useState } from "react";

import { INVENTORY_LABELS } from "@/constants/inventory";
import { INVENTORY_OVERVIEW_PERMISSIONS, WAREHOUSE_PERMISSIONS } from "@/constants/permissions";

import { usePermissionChecker } from "@/lib/auth";

import { EmptyState } from "@/components/shared/EmptyState";

import { InventoryOffline } from "./InventoryFeedback";
import { InventoryPermissionGate } from "./InventoryPermissionGate";
import { InventoryReservationsSection } from "./InventoryReservationsSection";
import { InventorySkuLookup } from "./InventorySkuLookup";
import { StockOverviewSection } from "./StockOverviewSection";

const { stockRead, reservationRead, alertRead } = INVENTORY_OVERVIEW_PERMISSIONS;

/**
 * Inventory Overview (SCRUM-438). Opens with stock READ or reservation READ; alert READ alone does
 * not. Each section is mounted only for its own permission, so no request is ever sent and then
 * hidden. UI-only — the backend re-checks every read (@RequiresPermission, InventoryController).
 */
export function InventoryOverview() {
  return (
    <InventoryPermissionGate anyOf={[stockRead, reservationRead]} variant="list">
      <InventoryOverviewContent />
    </InventoryPermissionGate>
  );
}

function InventoryOverviewContent() {
  const can = usePermissionChecker();
  const [activeSku, setActiveSku] = useState<string | null>(null);
  const [warehouseCode, setWarehouseCode] = useState<string | null>(null);
  // Resolving a stock-level code to a warehouse id needs the directory (GET /warehouses,
  // warehouse-warehouses:READ). Without it nothing downstream of the warehouse is requested.
  const canResolveWarehouse = can(stockRead) && can(WAREHOUSE_PERMISSIONS.read);

  // A new SKU drops everything chosen for the previous one; each section is keyed by the SKU (in its
  // own key namespace — siblings must not share a key), so its pages and filters start over too.
  const submit = (sku: string) => {
    setActiveSku(sku);
    setWarehouseCode(null);
  };

  return (
    // Giao diện kiểu Vercel (globals.css `.surface-soft`): không tiêu đề hiển thị — breadcrumb là tên trang.
    <div className="surface-soft space-y-[var(--card-pad)]">
      <h1 className="sr-only">{INVENTORY_LABELS.overviewTitle}</h1>
      <InventoryOffline />
      <InventorySkuLookup activeSku={activeSku} onSubmit={submit} />
      {activeSku === null ? (
        <EmptyState
          title={INVENTORY_LABELS.skuPrompt}
          description={INVENTORY_LABELS.skuPromptDescription}
        />
      ) : (
        <>
          {can(stockRead) && (
            <StockOverviewSection
              key={`stock:${activeSku}`}
              sku={activeSku}
              showAlerts={can(alertRead)}
              canResolveWarehouse={canResolveWarehouse}
              warehouseCode={warehouseCode}
              onSelectWarehouse={setWarehouseCode}
            />
          )}
          {can(reservationRead) && (
            <InventoryReservationsSection
              key={`holds:${activeSku}`}
              sku={activeSku}
              // Only a warehouse resolved in the stock section (stock + directory READ) may narrow holds.
              warehouseCode={canResolveWarehouse ? warehouseCode : null}
            />
          )}
        </>
      )}
    </div>
  );
}
