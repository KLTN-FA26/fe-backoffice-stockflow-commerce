"use client";

import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";

import { INVENTORY_COPY } from "../constants";
import { AtpLookupPanel } from "./AtpLookupPanel";
import { ReservationsPanel } from "./ReservationsPanel";
import { StockItemDrillDown } from "./StockItemDrillDown";
import { StockLevelsPanel } from "./StockLevelsPanel";

import type { InventoryService } from "../service";
import type { InventoryOverviewData, StockLevelRow } from "../types";

/** Stock-level data comes from the overview; each other panel owns its query. */
export function InventoryOverviewView({
  data,
  service,
  showReservations,
}: {
  data: InventoryOverviewData;
  service: InventoryService;
  showReservations: boolean;
}) {
  const [selected, setSelected] = useState<StockLevelRow | null>(null);
  return (
    <div className="space-y-[var(--card-pad)]">
      <PageHeader title={INVENTORY_COPY.title} subtitle={INVENTORY_COPY.subtitle} />
      <StockLevelsPanel rows={data.stockLevels} onSelect={setSelected} />
      <StockItemDrillDown selected={selected} service={service} />
      <div className="grid gap-[var(--card-pad)] lg:grid-cols-2">
        <AtpLookupPanel rows={data.stockLevels} service={service} />
        {showReservations && <ReservationsPanel service={service} />}
      </div>
    </div>
  );
}
