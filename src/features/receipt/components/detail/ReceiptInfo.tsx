"use client";

import { UI_LABELS } from "@/constants";
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
const OVER = UI_LABELS.receipt.overTolerance;
const OVER_BLIND = UI_LABELS.receipt.blind;

/** Người trong phiếu: tên BE trả kèm (nếu có), tooltip là id. */
const person = (id: string | null | undefined, name: string | null | undefined) => (
  <span title={id ?? undefined}>{name ?? id ?? "—"}</span>
);

export function ReceiptInfo({ receipt }: { receipt: GoodsReceipt }) {
  return (
    <Section title="Thông tin phiếu">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {/* Trang chi tiết không có tiêu đề — số phiếu nằm ở đây */}
        <InfoItem label="Số phiếu" value={receipt.number} mono />
        {receipt.withoutPurchaseOrder ? (
          // BR-RCP-002: hàng về không có PO — hiện NCC và lý do thay cho đơn đặt hàng
          <>
            <InfoItem label="Đơn đặt hàng" value={OVER_BLIND.badge} />
            <InfoItem label={OVER_BLIND.infoSupplier} value={receipt.supplierName ?? "—"} />
            <InfoItem label={OVER_BLIND.infoReason} value={receipt.blindReason ?? "—"} />
          </>
        ) : (
          <InfoItem label="Đơn đặt hàng" value={receipt.purchaseOrderNumber ?? "—"} mono />
        )}
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
      {receipt.approval && (
        <ApprovalInfo approval={receipt.approval} withoutPo={receipt.withoutPurchaseOrder} />
      )}
    </Section>
  );
}

/**
 * BR-RCP-001: phiếu từng đếm vượt dung sai — ai gửi duyệt, và khi đã quyết định thì Quản lý kho nào
 * đã duyệt / từ chối phần vượt, lúc nào, vì sao.
 */
function ApprovalInfo({
  approval,
  withoutPo,
}: {
  approval: NonNullable<GoodsReceipt["approval"]>;
  withoutPo: boolean;
}) {
  return (
    <div className="border-border-default mt-4 border-t pt-3">
      <h3 className="text-ink-primary mb-2 text-[0.8125rem] font-semibold">
        {withoutPo ? "Duyệt nhận hàng không có PO" : "Duyệt nhận vượt dung sai"}
      </h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <InfoItem
          label={OVER.requestedBy}
          value={person(approval.requestedBy, approval.requestedByName)}
        />
        <InfoItem label={OVER.requestedAt} value={dt(approval.requestedAt)} />
        <InfoItem
          label={OVER.decision}
          value={approval.decision ? OVER.decisionLabels[approval.decision] : "Đang chờ"}
        />
        {approval.decision && (
          <>
            <InfoItem
              label={OVER.decidedBy}
              value={person(approval.decidedBy, approval.decidedByName)}
            />
            <InfoItem label={OVER.decidedAt} value={dt(approval.decidedAt)} />
            <InfoItem label={OVER.reason} value={approval.reason ?? "—"} />
          </>
        )}
      </div>
    </div>
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
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow)">
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
