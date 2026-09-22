import { Contact } from "lucide-react";

import { AddressBlock } from "./DetailBlocks";
import { InfoRow } from "./InfoRow";

import type { SupplierDto } from "@/features/supplier/types";

export function ContactAddressCard({ supplier }: { supplier: SupplierDto }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Contact className="text-accent size-4" /> Liên hệ & Địa chỉ
      </h2>
      <div>
        <InfoRow label="Người liên hệ" value={supplier.contactName} />
        <InfoRow label="Email" value={supplier.contactEmail} />
        <InfoRow label="Điện thoại" value={supplier.contactPhone} mono />
        <div className="border-border-default flex items-start justify-between gap-4 border-b py-2 last:border-b-0">
          <span className="text-ink-tertiary text-xs font-medium">Địa chỉ</span>
          <span className="text-right">
            <AddressBlock address={supplier.address} />
          </span>
        </div>
      </div>
    </section>
  );
}
