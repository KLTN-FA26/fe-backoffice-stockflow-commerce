"use client";

import { FileText } from "lucide-react";

import { PO_CLOSE_KIND, UI_LABELS } from "@/constants";
import { formatDate } from "@/lib/format";
import { hasDeliveryDateWarning } from "@/features/purchase-order";
import { Alert } from "@/components/shared/Alert";
import { StatusDot } from "@/components/shared/StatusDot";

import { InfoRow } from "./InfoRow";

import type { PurchaseOrder } from "@/features/purchase-order";

/** BE PR #71 `closeKind`: trước đây đóng thiếu là trạng thái riêng `CLOSED_SHORT`. */
const CLOSE_KIND_LABEL: Record<string, string> = {
  [PO_CLOSE_KIND.NORMAL]: "Nhận đủ rồi đóng",
  [PO_CLOSE_KIND.SHORT_CLOSE]: "Đóng thiếu",
  [PO_CLOSE_KIND.FORCE_CLOSE]: "Đóng bắt buộc",
};

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
        {po.closeKind && (
          <InfoRow label="Kiểu đóng" value={CLOSE_KIND_LABEL[po.closeKind] ?? po.closeKind} />
        )}
        <InfoRow label="Kho nhận" value={po.warehouseName ?? "—"} />
        <InfoRow label="Ngày đặt" value={formatDate(po.orderDate)} />
        <InfoRow
          label={UI_LABELS.purchaseOrder.expectedDate}
          value={po.expectedDate ? formatDate(po.expectedDate) : "—"}
        />
        <InfoRow label="Người tạo" value={po.createdBy || "—"} />
        {po.note && <InfoRow label="Ghi chú" value={po.note} />}
        {po.rejectionReason && <InfoRow label="Lý do huỷ/đóng" value={po.rejectionReason} danger />}
      </div>
      {/* BR-06 (docs 02 §6): BE #36 trả `warnings` DELIVERY_DATE_IN_PAST — chỉ cảnh báo. */}
      {hasDeliveryDateWarning(po) && (
        <div role="status" className="mt-3">
          <Alert tone="warning">{UI_LABELS.purchaseOrder.deliveryDateInPast}</Alert>
        </div>
      )}
    </section>
  );
}
