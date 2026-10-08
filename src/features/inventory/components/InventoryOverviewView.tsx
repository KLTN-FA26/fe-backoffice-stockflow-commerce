"use client";

import { useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

import { INVENTORY_COPY } from "../constants";
import { AtpLookupPanel } from "./AtpLookupPanel";
import { StockItemDrillDown } from "./StockItemDrillDown";
import { StockLevelsPanel } from "./StockLevelsPanel";

import type { InventoryService } from "../service";
import type { InventoryPreview, StockLevelRow } from "../types";

/** Mock-backed overview. Remaining sections become interactive in later steps. */
export function InventoryOverviewView({
  data,
  service,
}: {
  data: InventoryPreview;
  service: InventoryService;
}) {
  const [selected, setSelected] = useState<StockLevelRow | null>(null);
  return (
    <div className="space-y-[var(--card-pad)]">
      <PageHeader title={INVENTORY_COPY.title} subtitle={INVENTORY_COPY.subtitle} />
      <StockLevelsPanel rows={data.stockLevels} onSelect={setSelected} />
      <StockItemDrillDown selected={selected} service={service} />
      <div className="grid gap-[var(--card-pad)] lg:grid-cols-2">
        <AtpLookupPanel rows={data.stockLevels} service={service} />
        <section
          aria-labelledby="inventory-reservations"
          className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]"
        >
          <h2 id="inventory-reservations" className="text-ink-primary mb-3 font-semibold">
            Reservations
          </h2>
          <div className="text-ink-secondary space-y-[var(--el-gap)] text-sm">
            {data.reservations.length === 0 ? (
              <EmptyState title={INVENTORY_COPY.empty} />
            ) : (
              data.reservations.map((row) => (
                <p key={row.id} className="font-mono">
                  {row.orderReference} · {row.sku}
                </p>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
