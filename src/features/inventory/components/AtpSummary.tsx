"use client";

import { INVENTORY_LABELS } from "@/constants/inventory";

import { formatNumber } from "@/lib/format/number";

import { Skeleton } from "@/components/shared/Skeleton";

import { useAtp } from "../queries";
import { InventoryError } from "./InventoryFeedback";

/**
 * ATP straight from GET /stock-items/atp for one warehouse code — never the stock-level row's atp
 * and never a system-wide read (the backend skips warehouse scope when `warehouse` is absent).
 * Zero is an answer, shown as 0.
 */
export function AtpSummary({ sku, warehouseCode }: { sku: string; warehouseCode: string }) {
  const atp = useAtp({ sku, warehouse: warehouseCode });

  return (
    <section
      aria-labelledby="inventory-atp"
      className="border-border-default bg-bg-subtle rounded-[var(--r-sm)] border p-[var(--card-pad)]"
    >
      <h3 id="inventory-atp" className="text-ink-secondary text-xs">
        {INVENTORY_LABELS.atpTitle} · <span className="font-mono">{sku}</span> ·{" "}
        <span className="font-mono">{warehouseCode}</span>
      </h3>
      {atp.isLoading ? (
        <div role="status" aria-label={INVENTORY_LABELS.atpLoading}>
          <Skeleton className="h-8 w-24" />
        </div>
      ) : atp.isError ? (
        <InventoryError error={atp.error} retry={() => void atp.refetch()} />
      ) : atp.data !== undefined ? (
        <output className="block">
          <span className="text-ink-primary font-mono text-2xl font-semibold tabular-nums">
            {formatNumber(atp.data)}
          </span>
          {atp.data === 0 && (
            <span className="text-ink-secondary block text-xs">{INVENTORY_LABELS.atpZero}</span>
          )}
        </output>
      ) : null}
    </section>
  );
}
