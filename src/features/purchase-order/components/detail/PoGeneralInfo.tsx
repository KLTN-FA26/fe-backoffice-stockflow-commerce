"use client";

import { FileText } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { formatDate } from "@/lib/format";
import { StatusDot } from "@/components/shared/StatusDot";

import { InfoRow } from "./InfoRow";

import type { PurchaseOrder } from "@/features/purchase-order";

export function PoGeneralInfo({ po }: { po: PurchaseOrder }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <FileText className="text-accent size-4" />
        Thông tin chung
      </h2>
      <div>
        <InfoRow label="Số PO" value={po.poNumber} mono />
        <InfoRow label={UI_LABELS.purchaseOrder.status}>
          <StatusDot domain="po" status={po.status} size="sm" withIcon />
        </InfoRow>
        <InfoRow label="Ngày tạo" value={formatDate(po.orderDate)} />
        <InfoRow
          label={UI_LABELS.purchaseOrder.expectedDate}
          value={po.expectedDate ? formatDate(po.expectedDate) : "—"}
        />
        <InfoRow label="Người tạo" value={po.createdBy || "—"} />
        {po.rejectionReason && <InfoRow label="Lý do huỷ/đóng" value={po.rejectionReason} danger />}
      </div>
    </section>
  );
}
