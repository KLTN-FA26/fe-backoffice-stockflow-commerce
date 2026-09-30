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
      <div className="flex items-baseline justify-between text-[0.9375rem]">
        <span className="text-ink-primary font-semibold">Tổng giá trị</span>
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-base font-bold tabular-nums">
          {formatMoney(po.grandTotal, po.currency)}
        </span>
      </div>
      <p className="text-ink-tertiary mt-2 text-xs">
        Theo BE: Σ SL đặt × đơn giá — BE chưa tính thuế/chiết khấu cho PO.
      </p>
    </section>
  );
}
