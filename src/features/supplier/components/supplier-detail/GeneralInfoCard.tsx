import { Building2 } from "lucide-react";

import { SUPPLIER_FIELD_LABELS } from "@/constants";
import { StatusDot } from "@/components/shared/StatusDot";

import { InfoRow } from "./InfoRow";

import type { SupplierDto } from "@/features/supplier/types";

export function GeneralInfoCard({ supplier }: { supplier: SupplierDto }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Building2 className="text-accent size-4" /> Thông tin chung
      </h2>
      <div>
        <InfoRow label={SUPPLIER_FIELD_LABELS.codeShort} value={supplier.code} mono />
        <InfoRow label={SUPPLIER_FIELD_LABELS.status}>
          <StatusDot domain="sku" status={supplier.status} size="sm" withIcon />
        </InfoRow>
        <InfoRow label={SUPPLIER_FIELD_LABELS.taxCode} value={supplier.taxCode ?? "—"} mono />
      </div>
    </section>
  );
}
