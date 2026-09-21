"use client";

import { FileText } from "lucide-react";

import { StatusDot } from "@/components/shared/StatusDot";
import type { PurchaseOrder } from "@/features/purchase-order";

import { InfoRow } from "./InfoRow";

export function PoGeneralInfo({ po }: { po: PurchaseOrder }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <FileText className="text-accent size-4" />
        Thông tin chung
      </h2>
      <div>
        <InfoRow label="Số PO" value={po.poNumber} mono />
        <InfoRow label="Trạng thái">
          <StatusDot domain="po" status={po.status as never} size="sm" withIcon />
        </InfoRow>
        <InfoRow label="Ngày đặt" value={po.orderDate} mono />
        <InfoRow label="Ngày giao DK" value={po.expectedDate} mono />
        <InfoRow label="Người tạo" value={po.createdBy} />
        <InfoRow label="Người duyệt" value={po.approvedBy ?? "—"} />
        {po.notes && <InfoRow label="Ghi chú" value={po.notes} />}
        {po.rejectionReason && <InfoRow label="Lý do huỷ/đóng" value={po.rejectionReason} danger />}
      </div>
    </section>
  );
}
