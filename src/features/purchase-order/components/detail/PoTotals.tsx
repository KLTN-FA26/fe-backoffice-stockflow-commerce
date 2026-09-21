"use client";

import { ClipboardCheck } from "lucide-react";
import { formatMoney } from "@/features/purchase-order";
import type { PurchaseOrder } from "@/features/purchase-order";

export function PoTotals({ po }: { po: PurchaseOrder }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <ClipboardCheck className="text-accent size-4" />
        Tổng cộng
      </h2>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between text-[0.8125rem]">
          <span className="text-ink-secondary">Tạm tính</span>
          <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium tabular-nums">
            {formatMoney(po.subtotal, po.currency)}
          </span>
        </div>
        <div className="flex items-baseline justify-between text-[0.8125rem]">
          <span className="text-ink-secondary">Thuế</span>
          <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium tabular-nums">
            {formatMoney(po.taxTotal, po.currency)}
          </span>
        </div>
        <div className="border-border-default flex items-baseline justify-between border-t pt-2 text-[0.9375rem]">
          <span className="text-ink-primary font-semibold">Tổng giá trị</span>
          <span className="text-ink-primary font-[family-name:var(--font-mono)] text-base font-bold tabular-nums">
            {formatMoney(po.grandTotal, po.currency)}
          </span>
        </div>
      </div>
    </section>
  );
}
