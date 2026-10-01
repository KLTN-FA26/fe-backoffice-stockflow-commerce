import { Landmark } from "lucide-react";

import type { SupplierDto } from "@/features/supplier/types";

function TermTile({ label, days }: { label: string; days: number }) {
  return (
    <div className="border-border-default bg-bg-subtle rounded-[var(--r-sm)] border px-3 py-2">
      <div className="text-ink-tertiary text-xs">{label}</div>
      <div className="text-ink-primary mt-1 font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
        {days} ngày
      </div>
    </div>
  );
}

export function TermsOpsCard({ supplier }: { supplier: SupplierDto }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Landmark className="text-accent size-4" /> Điều khoản thương mại
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TermTile label="Thời hạn thanh toán" days={supplier.paymentTermDays} />
        <TermTile label="Thời gian giao hàng" days={supplier.leadTimeDays} />
      </div>
    </section>
  );
}
