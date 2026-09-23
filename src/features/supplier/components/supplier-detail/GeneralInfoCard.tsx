import { Building2 } from "lucide-react";

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
        <InfoRow label="Mã NCC" value={supplier.supplierId} mono />
        {supplier.code && <InfoRow label="Mã BE" value={supplier.code} mono />}
        <InfoRow label="Trạng thái">
          <StatusDot domain="sku" status={supplier.status} size="sm" withIcon />
        </InfoRow>
        <InfoRow label="Mã số thuế" value={supplier.taxCode} mono />
        {supplier.rating != null && (
          <InfoRow label="Đánh giá" value={`${supplier.rating.toFixed(1)} / 5`} />
        )}
      </div>
    </section>
  );
}
