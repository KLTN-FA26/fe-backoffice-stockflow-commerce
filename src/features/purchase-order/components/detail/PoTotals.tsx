"use client";

import { ClipboardCheck } from "lucide-react";
import { UI_LABELS } from "@/constants";
import { formatMoney } from "@/features/purchase-order";
import type { PurchaseOrder } from "@/features/purchase-order";

export function PoTotals({ po }: { po: PurchaseOrder }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <ClipboardCheck className="text-accent size-4" />
        Tổng cộng
      </h2>
      <div className="flex items-baseline justify-between text-[0.9375rem]">
        <span className="text-ink-primary font-semibold">{UI_LABELS.purchaseOrder.grandTotal}</span>
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-base font-bold tabular-nums">
          {formatMoney(po.grandTotal, po.currency)}
        </span>
      </div>
      <p className="text-ink-tertiary mt-2 text-xs">
        Tổng = Σ (SL đặt × đơn giá), chưa gồm thuế và chiết khấu.
      </p>
    </section>
  );
}
