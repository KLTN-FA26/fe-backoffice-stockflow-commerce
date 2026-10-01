import { Contact } from "lucide-react";

import { InfoRow } from "./InfoRow";

import type { SupplierDto } from "@/features/supplier/types";

const CHANNEL_LABEL = { EMAIL: "Email", API: "API" } as const;

export function ContactChannelCard({ supplier }: { supplier: SupplierDto }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Contact className="text-accent size-4" /> Liên hệ & kênh gửi PO
      </h2>
      <div>
        <InfoRow label="Người liên hệ" value={supplier.contactName ?? "—"} />
        <InfoRow label="Email" value={supplier.email ?? "—"} />
        <InfoRow label="Điện thoại" value={supplier.phone ?? "—"} mono />
        <InfoRow label="Kênh gửi PO" value={CHANNEL_LABEL[supplier.communicationChannel]} />
        {supplier.communicationChannel === "API" && (
          <InfoRow label="API endpoint" value={supplier.apiEndpoint ?? "—"} mono />
        )}
      </div>
    </section>
  );
}
