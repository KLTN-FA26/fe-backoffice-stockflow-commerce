"use client";

import { UI_LABELS } from "@/constants";
import { formatMoney } from "@/features/purchase-order";

import { Card } from "@/components/shared/Card";

import { SectionTitle } from "./CreateFormPrimitives";
import { lineTotal } from "./helpers";
import type { PoCreateFormLine } from "@/features/purchase-order";
import type { Totals } from "./types";

/** SL nhập dạng chuỗi → "1.000.000" (vi-VN); chưa hợp lệ thì hiện nguyên văn. */
function formatQty(raw: string): string {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) ? n.toLocaleString("vi-VN") : raw || "0";
}

export function TotalsStep({
  totals,
  currency,
  lines,
}: {
  totals: Totals;
  currency: string;
  lines: readonly PoCreateFormLine[];
}) {
  return (
    <Card>
      <SectionTitle
        title={UI_LABELS.purchaseOrder.totals}
        description="Tổng giá trị PO = Σ (số lượng × đơn giá), chưa gồm thuế và chiết khấu."
      />
      {/* BE chưa có thuế / chiết khấu → tạm tính = tổng, chỉ hiện một số. */}
      <div className="grid gap-3 md:grid-cols-2">
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
          lines.map((line, i) => (
            <div
              key={i}
              className="border-border-default grid gap-2 border-b px-3 py-2 text-[0.8125rem] last:border-b-0 md:grid-cols-[1fr_90px_120px_120px]"
            >
              <div className="min-w-0">
                <div className="text-ink-primary truncate font-medium">
                  {line.skuId || UI_LABELS.purchaseOrder.skuMissing}
                </div>
                <div className="text-ink-tertiary truncate text-xs">{line.description || "—"}</div>
              </div>
              <div className="text-ink-secondary text-right font-[family-name:var(--font-mono)] tabular-nums">
                {formatQty(line.orderedQty)}
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
