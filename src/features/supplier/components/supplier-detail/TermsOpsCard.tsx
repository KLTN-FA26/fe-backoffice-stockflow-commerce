import { Landmark } from "lucide-react";

import { SUPPLIER_FIELD_LABELS } from "@/constants";

import type { SupplierDto } from "@/features/supplier/types";

function TermTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border-default bg-bg-subtle rounded-[var(--r-sm)] border px-3 py-2">
      <div className="text-ink-tertiary text-xs">{label}</div>
      <div className="text-ink-primary mt-1 font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
        {value}
      </div>
    </div>
  );
}

const percent = (value: number | null | undefined) =>
  value == null ? "Theo mặc định" : `${value}%`;

export function TermsOpsCard({ supplier }: { supplier: SupplierDto }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Landmark className="text-accent size-4" /> Điều khoản thương mại
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TermTile
          label={SUPPLIER_FIELD_LABELS.paymentTermDays}
          value={`${supplier.paymentTermDays} ngày`}
        />
        <TermTile
          label={SUPPLIER_FIELD_LABELS.leadTimeDays}
          value={`${supplier.leadTimeDays} ngày`}
        />
        <TermTile
          label={SUPPLIER_FIELD_LABELS.overReceiptTolerancePercent}
          value={percent(supplier.overReceiptTolerancePercent)}
        />
        <TermTile
          label={SUPPLIER_FIELD_LABELS.printSubcontractor}
          value={
            supplier.printSubcontractor
              ? `Có — hao hụt ${percent(supplier.lossTolerancePercent)}`
              : "Không"
          }
        />
      </div>
    </section>
  );
}
