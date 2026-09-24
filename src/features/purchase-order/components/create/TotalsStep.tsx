"use client";

import { formatMoney } from "@/features/purchase-order";

import type { Currency } from "@/features/purchase-order";
import { Card } from "@/components/shared/Card";

import { SectionTitle, SummaryItem } from "./CreateFormPrimitives";
import { lineTotal } from "./helpers";
import type { PoLineDraft, Totals } from "./types";

export function TotalsStep({
  totals,
  currency,
  lines,
}: {
  totals: Totals;
  currency: Currency;
  lines: PoLineDraft[];
}) {
  return (
    <Card>
      <SectionTitle
        title="Tổng cộng"
        description="Tổng giá trị PO = Σ (số lượng × đơn giá) — khớp cách BE tính totalAmount."
      />
      <div className="grid gap-3 md:grid-cols-2">
        <SummaryItem
          label="Tạm tính (Subtotal)"
          value={formatMoney(totals.subtotal, currency)}
          mono
        />
        <div className="border-accent/40 bg-accent/5 rounded-[var(--r-sm)] border px-3 py-2">
          <div className="text-ink-tertiary text-xs">Tổng giá trị PO</div>
          <div className="text-accent mt-1 truncate font-[family-name:var(--font-mono)] text-[1rem] font-semibold tabular-nums">
            {formatMoney(totals.grandTotal, currency)}
          </div>
        </div>
      </div>
      <div className="border-border-default mt-5 rounded-[var(--r-sm)] border">
        {lines.length === 0 ? (
          <div className="text-ink-tertiary px-3 py-6 text-center text-[0.8125rem]">
            Chưa có dòng hàng để tính tổng.
          </div>
        ) : (
          lines.map((line) => (
            <div
              key={line.id}
              className="border-border-default grid gap-2 border-b px-3 py-2 text-[0.8125rem] last:border-b-0 md:grid-cols-[1fr_90px_120px_120px]"
            >
              <div className="min-w-0">
                <div className="text-ink-primary truncate font-medium">
                  {line.skuId || "Chưa chọn SKU"}
                </div>
                <div className="text-ink-tertiary truncate text-xs">{line.description || "—"}</div>
              </div>
              <div className="text-ink-secondary text-right font-[family-name:var(--font-mono)] tabular-nums">
                {line.orderedQty || "0"} {line.uom}
              </div>
              <div className="text-ink-secondary text-right font-[family-name:var(--font-mono)] tabular-nums">
                {formatMoney(Number(line.unitPrice) || 0, currency)}
              </div>
              <div className="text-ink-primary text-right font-[family-name:var(--font-mono)] font-medium tabular-nums">
                {formatMoney(lineTotal(line), currency)}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
