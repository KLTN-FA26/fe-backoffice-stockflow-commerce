import { Contact } from "lucide-react";

import { SUPPLIER_CHANNEL_LABELS, SUPPLIER_FIELD_LABELS } from "@/constants";

import { InfoRow } from "./InfoRow";

import type { SupplierDto } from "@/features/supplier/types";

export function ContactChannelCard({ supplier }: { supplier: SupplierDto }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Contact className="text-accent size-4" /> Liên hệ & kênh gửi PO
      </h2>
      <div>
        <InfoRow label={SUPPLIER_FIELD_LABELS.contactName} value={supplier.contactName ?? "—"} />
        <InfoRow label={SUPPLIER_FIELD_LABELS.email} value={supplier.email ?? "—"} />
        <InfoRow label={SUPPLIER_FIELD_LABELS.phone} value={supplier.phone ?? "—"} mono />
        <InfoRow
          label={SUPPLIER_FIELD_LABELS.communicationChannel}
          value={SUPPLIER_CHANNEL_LABELS[supplier.communicationChannel]}
        />
        {supplier.communicationChannel === "API" && (
          <InfoRow
            label={SUPPLIER_FIELD_LABELS.apiEndpoint}
            value={supplier.apiEndpoint ?? "—"}
            mono
          />
        )}
      </div>
    </section>
  );
}
