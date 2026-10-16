"use client";

import { classifyLoadError } from "@/lib/api/load-error";
import { formatDateTime } from "@/lib/format/date";
import { useReceivablePurchaseOrder } from "@/features/receipt/queries";
import {
  pendingQcLineCount,
  qcRequiredLineCount,
  totalReceivedQuantity,
} from "@/features/receipt/selectors";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { InfoItem, Section } from "../primitives";
import { ReceiptLoadError } from "../ReceiptLoadError";
import { CountLinesForm } from "./CountLinesForm";

import type { GoodsReceipt } from "@/features/receipt/types";

const dt = (iso: string | null | undefined) => (iso ? formatDateTime(iso) : "—");

export function ReceiptInfo({ receipt }: { receipt: GoodsReceipt }) {
  return (
    <Section title="Thông tin phiếu">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <InfoItem label="Đơn đặt hàng" value={receipt.purchaseOrderNumber ?? "—"} mono />
        <InfoItem label="Phiếu giao NCC" value={receipt.deliveryNote ?? "—"} mono />
        <InfoItem label="Ngày nhận" value={dt(receipt.receivedAt)} />
        {/* BE chỉ trả `receivedBy` / `confirmedBy` là UUID, chưa có API tra tên người dùng */}
        <InfoItem
          label="Người nhận"
          value={<span title={receipt.receivedBy ?? undefined}>{receipt.receivedBy ?? "—"}</span>}
          mono
        />
        <InfoItem label="Ngày xác nhận" value={dt(receipt.confirmedAt)} />
        <InfoItem
          label="Người xác nhận"
          value={<span title={receipt.confirmedBy ?? undefined}>{receipt.confirmedBy ?? "—"}</span>}
          mono
        />
        <InfoItem label="Ngày đóng" value={dt(receipt.closedAt)} />
        <InfoItem label="Ghi chú" value={receipt.note ?? "—"} />
      </div>
    </Section>
  );
}

/** Cột phải — số liệu derive từ dòng BE trả về (cùng bố cục `OverviewCard` của supplier). */
export function ReceiptOverviewCard({ receipt }: { receipt: GoodsReceipt }) {
  const rows = [
    { label: "Số dòng", value: receipt.lines.length },
    { label: "Tổng SL nhận", value: totalReceivedQuantity(receipt) },
    { label: "Dòng cần QC", value: qcRequiredLineCount(receipt) },
    { label: "Dòng chờ QC", value: pendingQcLineCount(receipt) },
  ];
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">Tổng quan</h2>
      <dl className="space-y-2 text-[0.8125rem]">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between">
            <dt className="text-ink-secondary">{row.label}</dt>
            <dd className="text-ink-primary font-[family-name:var(--font-mono)] font-medium tabular-nums">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Phiếu DRAFT: nạp dòng PO (cần purchase-orders:READ) rồi mở form kiểm đếm.
 * BE gap (trước C4): `openQuantity` của API PO đọc bảng PO cũ — không trừ SL trên các phiếu nhận
 * (kể cả nháp) mà BE cộng khi kiểm dung sai, nên số gợi ý có thể vượt; BE chặn bằng 409 khi lưu.
 */
export function CountSection({
  receipt,
  onDirtyChange,
  onSaved,
  onCancel,
}: {
  receipt: GoodsReceipt;
  onDirtyChange: (d: boolean) => void;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const po = useReceivablePurchaseOrder(receipt.purchaseOrderId);
  if (po.isPending) return <PageSkeleton variant="form" />;
  if (po.isError) {
    // 404 ở đây là PO của phiếu, không phải phiếu — tránh báo nhầm "Không tìm thấy phiếu nhận"
    const kind = classifyLoadError(po.error) === "not-found" ? "po-not-found" : undefined;
    return (
      <ReceiptLoadError inline error={po.error} kind={kind} onRetry={() => void po.refetch()} />
    );
  }
  return (
    <CountLinesForm
      receipt={receipt}
      po={po.data}
      onDirtyChange={onDirtyChange}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}
