"use client";

import { ClipboardCheck } from "lucide-react";
import { UI_LABELS } from "@/constants";
import { formatMoney } from "@/features/purchase-order";
import type { PurchaseOrder } from "@/features/purchase-order";

/** BE PR #71: `subtotal` (Σ SL × đơn giá), `taxTotal` (Σ thuế từng dòng), `totalAmount` = tổng hai. */
export function PoTotals({ po }: { po: PurchaseOrder }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <ClipboardCheck className="text-accent size-4" />
        Tổng cộng
      </h2>
      <dl className="space-y-1.5">
        <Row label="Tạm tính" value={formatMoney(po.subtotal, po.currency)} />
        <Row label="Thuế" value={formatMoney(po.taxTotal, po.currency)} />
        <div className="border-border-default flex items-baseline justify-between border-t pt-2 text-[0.9375rem]">
          <dt className="text-ink-primary font-semibold">{UI_LABELS.purchaseOrder.grandTotal}</dt>
          <dd className="text-ink-primary font-[family-name:var(--font-mono)] text-base font-bold tabular-nums">
            {formatMoney(po.grandTotal, po.currency)}
          </dd>
        </div>
      </dl>
      <p className="text-ink-tertiary mt-2 text-xs">Chưa gồm chiết khấu và phí vận chuyển.</p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[0.8125rem]">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="text-ink-primary font-[family-name:var(--font-mono)] tabular-nums">{value}</dd>
    </div>
  );
}
