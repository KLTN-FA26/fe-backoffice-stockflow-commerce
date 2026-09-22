import { Landmark } from "lucide-react";

import type { SupplierDto } from "@/features/supplier/types";

export function TermsOpsCard({ supplier }: { supplier: SupplierDto }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Landmark className="text-accent size-4" /> Điều khoản & vận hành
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="border-border-default bg-bg-subtle rounded-[var(--r-sm)] border px-3 py-2">
          <div className="text-ink-tertiary text-xs">Điều khoản thanh toán</div>
          <div className="text-ink-primary mt-1 text-[0.8125rem] font-medium">
            {supplier.paymentTerms ?? "—"}
          </div>
        </div>
        <div className="border-border-default bg-bg-subtle rounded-[var(--r-sm)] border px-3 py-2">
          <div className="text-ink-tertiary text-xs">Tiền tệ (BR-07)</div>
          <div className="text-ink-primary mt-1 font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
            {supplier.currency ?? "—"}
          </div>
        </div>
        <div className="border-border-default bg-bg-subtle rounded-[var(--r-sm)] border px-3 py-2">
          <div className="text-ink-tertiary text-xs">Lead time</div>
          <div className="text-ink-primary mt-1 font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
            {supplier.leadTimeDays != null ? `${supplier.leadTimeDays} ngày` : "—"}
          </div>
        </div>
      </div>
    </section>
  );
}
