import { Package } from "lucide-react";

import { formatMoney } from "@/lib/format";

import type { OrderLine } from "../types";

interface OrderLinesProps {
  lines: readonly OrderLine[];
}

export function OrderLines({ lines }: OrderLinesProps) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Package className="text-accent size-4" />
        Dòng hàng ({lines.length})
      </h2>
      <div className="space-y-3">
        {lines.map((line) => (
          <div
            key={line.lineId}
            className="border-border-default flex gap-3 rounded-[var(--r-sm)] border p-3"
          >
            <div className="bg-bg-subtle text-ink-tertiary flex size-10 shrink-0 items-center justify-center rounded-[var(--r-sm)] text-lg">
              📦
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-ink-primary truncate text-[0.875rem] font-semibold">
                {line.productName}
              </div>
              <div className="text-ink-tertiary truncate text-xs">{line.variantLabel}</div>
              <div className="text-ink-secondary mt-1 flex items-center gap-3 text-xs">
                <span className="tabular-nums">×{line.quantity}</span>
                <span className="font-mono tabular-nums">{formatMoney(line.unitPrice)}</span>
                <span className="text-ink-primary ml-auto font-mono font-medium tabular-nums">
                  {formatMoney(line.lineTotal)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
