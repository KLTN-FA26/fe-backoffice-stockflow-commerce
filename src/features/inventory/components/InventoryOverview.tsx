"use client";

import { useState } from "react";

import { INVENTORY_LABELS } from "@/constants/inventory";
import { INVENTORY_OVERVIEW_PERMISSIONS } from "@/constants/permissions";

import { usePermissionChecker } from "@/lib/auth";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

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
    <InventoryPermissionGate permission={[stockRead, reservationRead]} variant="list">
      <InventoryOverviewContent />
    </InventoryPermissionGate>
  );
}

function InventoryOverviewContent() {
  const can = usePermissionChecker();
  const [activeSku, setActiveSku] = useState<string | null>(null);
  const [warehouseCode, setWarehouseCode] = useState<string | null>(null);

  // A new SKU drops everything chosen for the previous one; the sections are keyed by the SKU, so
  // their pages and filters start over too.
  const submit = (sku: string) => {
    setActiveSku(sku);
    setWarehouseCode(null);
  };

  return (
    <div className="space-y-[var(--card-pad)]">
      <PageHeader
        title={INVENTORY_LABELS.overviewTitle}
        subtitle={INVENTORY_LABELS.overviewSubtitle}
      />
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
              key={activeSku}
              sku={activeSku}
              showAlerts={can(alertRead)}
              warehouseCode={warehouseCode}
              onSelectWarehouse={setWarehouseCode}
            />
          )}
          {can(reservationRead) && (
            <InventoryReservationsSection
              key={activeSku}
              sku={activeSku}
              warehouseCode={warehouseCode}
            />
          )}
        </>
      )}
    </div>
  );
}
