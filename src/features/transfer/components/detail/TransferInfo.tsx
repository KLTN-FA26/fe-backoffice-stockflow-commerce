"use client";

import { TRANSFER_REASON_LABELS, UI_LABELS } from "@/constants";
import { useAuthStore } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { isTransferDispatched, isTransferInTransit } from "@/features/transfer/lifecycle";
import { totalRequested, totalShipped } from "@/features/transfer/selectors";
import { Alert } from "@/components/shared/Alert";

import { InfoItem, MONO, Section, useWarehouseLabel } from "../primitives";

import type { TransferOrder } from "@/features/transfer/types";

const L = UI_LABELS.transfer;
const dt = (iso: string | null | undefined) => (iso ? formatDateTime(iso) : "—");

/** BE chỉ trả UUID người thao tác (chưa có API tra tên) — người hiện tại hiện "Bạn". */
function Actor({ id }: { id: string | null | undefined }) {
  const currentUserId = useAuthStore((state) => state.user?.userId);
  if (!id) return <>—</>;
  if (id === currentUserId) return <>{L.you}</>;
  return (
    <span className={MONO} title={id}>
      {id.slice(0, 8)}…
    </span>
  );
}

export function TransferInfo({ transfer }: { transfer: TransferOrder }) {
  const warehouseLabel = useWarehouseLabel();
  return (
    <Section title={L.sectionInfo}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <InfoItem
          label={UI_LABELS.transfer.field.fromWarehouse}
          value={warehouseLabel(transfer.fromWarehouseId)}
        />
        <InfoItem
          label={UI_LABELS.transfer.field.toWarehouse}
          value={warehouseLabel(transfer.toWarehouseId)}
        />
        <InfoItem
          label={UI_LABELS.transfer.field.reason}
          value={transfer.reason ? TRANSFER_REASON_LABELS[transfer.reason] : "—"}
        />
        <InfoItem
          label={UI_LABELS.transfer.column.expectedDate}
          value={transfer.expectedDate ? formatDate(transfer.expectedDate) : "—"}
        />
        <InfoItem label={UI_LABELS.transfer.column.createdAt} value={dt(transfer.createdAt)} />
        <InfoItem
          label={UI_LABELS.transfer.column.dispatchedAt}
          value={dt(transfer.dispatchedAt)}
        />
      </div>
      {transfer.cancelReason && (
        <Alert tone="danger" title={L.confirm.cancelReason} className="mt-3">
          {transfer.cancelReason}
        </Alert>
      )}
    </Section>
  );
}

/** Cột phải: tổng SL + mốc thời gian gửi duyệt / duyệt / xuất kho. Không có tracking hành trình. */
export function TransferTimelineCard({ transfer }: { transfer: TransferOrder }) {
  const steps = [
    { label: L.action.submit, at: transfer.submittedAt, by: transfer.submittedBy },
    { label: L.action.approve, at: transfer.approvedAt, by: transfer.approvedBy },
    { label: L.action.dispatch, at: transfer.dispatchedAt, by: transfer.dispatchedBy },
  ];
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">{L.sectionTimeline}</h2>
      <dl className="space-y-2 text-[0.8125rem]">
        <div className="flex justify-between">
          <dt className="text-ink-secondary">{L.totalRequested}</dt>
          <dd className={`text-ink-primary font-medium ${MONO}`}>{totalRequested(transfer)}</dd>
        </div>
        {/* Chưa xuất kho thì SL đã xuất luôn 0 — bảng dòng cũng chỉ hiện cột này sau khi xuất */}
        {isTransferDispatched(transfer.status) && (
          <div className="flex justify-between">
            <dt className="text-ink-secondary">{L.totalShipped}</dt>
            <dd className={`text-ink-primary font-medium ${MONO}`}>{totalShipped(transfer)}</dd>
          </div>
        )}
      </dl>
      <ol className="border-border-default mt-3 space-y-2 border-t pt-3 text-[0.8125rem]">
        {steps.map((step) => (
          <li key={step.label} className="flex justify-between gap-2">
            <span className="text-ink-secondary">{step.label}</span>
            <span className="text-ink-primary text-right tabular-nums">
              {dt(step.at)}
              {step.at && (
                <span className="text-ink-tertiary block text-xs">
                  <Actor id={step.by} />
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
      {/* Chỉ khi hàng đang trên đường — nhận xong thì "trạng thái đổi khi kho đích nhận" không còn đúng */}
      {isTransferInTransit(transfer.status) && (
        <p className="text-ink-tertiary mt-3 text-xs">{L.noTracking}</p>
      )}
    </section>
  );
}
