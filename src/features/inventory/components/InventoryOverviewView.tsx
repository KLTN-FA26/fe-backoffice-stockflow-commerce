"use client";

import { useState } from "react";

import { formatNumber } from "@/lib/format/number";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

import { INVENTORY_COPY } from "../constants";
import { StockItemDrillDown } from "./StockItemDrillDown";
import { StockLevelsPanel } from "./StockLevelsPanel";

import type { InventoryService } from "../service";
import type { InventoryPreview, StockLevelRow } from "../types";
import type { ReactNode } from "react";

/** Mock-backed overview. Remaining sections become interactive in later steps. */
export function InventoryOverviewView({
  data,
  service,
}: {
  data: InventoryPreview;
  service: InventoryService;
}) {
  const [selected, setSelected] = useState<StockLevelRow | null>(null);
  const previews: ReactNode[] = [
    data.atp ? (
      <p className="font-mono tabular-nums">
        {data.atp.sku} · {data.atp.warehouseCode} · ATP: {formatNumber(data.atp.quantity)}
      </p>
    ) : null,
    data.reservations.map((row) => (
      <p key={row.id} className="font-mono">
        {row.orderReference} · {row.sku}
      </p>
    )),
  ];
  return (
    <div className="space-y-[var(--card-pad)]">
      <PageHeader title={INVENTORY_COPY.title} subtitle={INVENTORY_COPY.subtitle} />
      <StockLevelsPanel rows={data.stockLevels} onSelect={setSelected} />
      <StockItemDrillDown selected={selected} service={service} />
      <div className="grid gap-[var(--card-pad)] lg:grid-cols-2">
        {INVENTORY_COPY.sections.slice(2).map((section, index) => {
          const preview = previews[index];
          const empty = preview === null || (Array.isArray(preview) && preview.length === 0);
          return (
            <section
              key={section.id}
              aria-labelledby={`inventory-${section.id}`}
              className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]"
            >
              <h2 id={`inventory-${section.id}`} className="text-ink-primary mb-3 font-semibold">
                {section.title}
              </h2>
              <div className="text-ink-secondary space-y-[var(--el-gap)] text-sm">
                {empty ? <EmptyState title={INVENTORY_COPY.empty} /> : preview}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
