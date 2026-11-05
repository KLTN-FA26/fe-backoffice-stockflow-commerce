"use client";

import {
  TRANSFER_DELIVERY_MODE_LABELS,
  TRANSFER_REASON_LABELS,
  TRANSFER_STATUS,
  UI_LABELS,
} from "@/constants";
import { useAuthStore } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { isFtl } from "@/features/transfer/ftl-lifecycle";
import { isTransferDispatched, isTransferInTransit } from "@/features/transfer/lifecycle";
import { totalRequested, totalShipped } from "@/features/transfer/selectors";
import { Alert } from "@/components/shared/Alert";

import { InfoItem, MONO, Section, useWarehouseLabel } from "../primitives";

import type { TransferOrder } from "@/features/transfer/types";

const L = UI_LABELS.transfer;
const dt = (iso: string | null | undefined) => (iso ? formatDateTime(iso) : "—");

/** Đóng gói xong lúc nào; lệnh đã xuất mà không có mốc (dữ liệu cũ) → "—" chứ không "Chưa đóng gói". */
const packedText = (t: TransferOrder) =>
  t.packedAt
    ? dt(t.packedAt)
    : isTransferDispatched(t.status)
      ? "—"
      : UI_LABELS.transfer.deliveryMode.notPacked;

/** Hàng rời kho lúc nào: xe đầu ký nhận, hoặc lúc xuất kho của lệnh đã xuất. */
const leftText = (t: TransferOrder) =>
  t.goodsLeftAt || t.dispatchedAt
    ? dt(t.goodsLeftAt ?? t.dispatchedAt)
    : UI_LABELS.transfer.deliveryMode.notLeft;

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

/** Lần từ chối gần nhất (BE giữ lại, không xoá khi gửi lại) — nổi bật khi lệnh đang Nháp chờ sửa, còn lại chỉ là lịch sử. */
function RejectionNote({ transfer }: { transfer: TransferOrder }) {
  const R = L.rejection;
  const meta = (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      <dt className="text-ink-secondary">{R.by}</dt>
      <dd className="text-ink-primary">
        <Actor id={transfer.rejectedBy} />
      </dd>
      <dt className="text-ink-secondary">{R.at}</dt>
      <dd className="text-ink-primary tabular-nums">{dt(transfer.rejectedAt)}</dd>
    </dl>
  );
  if (transfer.status === TRANSFER_STATUS.DRAFT) {
    return (
      <Alert tone="danger" title={R.title} className="mt-3">
        <p>{transfer.rejectionReason}</p>
        {meta}
        <p className="mt-2 text-xs">{R.draftHint}</p>
      </Alert>
    );
  }
  return (
    <div className="border-border-default mt-3 border-t pt-3 text-[0.8125rem]">
      <p className="text-ink-secondary">{R.title}</p>
      <p className="text-ink-primary">{transfer.rejectionReason}</p>
      {meta}
    </div>
  );
}

export function TransferInfo({ transfer }: { transfer: TransferOrder }) {
  const warehouseLabel = useWarehouseLabel();
  return (
    <Section title={L.sectionInfo}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {/* Trang chi tiết không có tiêu đề — số lệnh nằm ở đây */}
        <InfoItem label={UI_LABELS.transfer.column.number} value={transfer.number} mono />
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
        <InfoItem
          label={UI_LABELS.transfer.deliveryMode.label}
          value={TRANSFER_DELIVERY_MODE_LABELS[transfer.deliveryMode]}
        />
        {/* Chỉ lệnh nguyên chuyến (FTL) có đóng gói + xe ký nhận; lệnh giao lẻ không có hai mốc này */}
        {isFtl(transfer) && (
          <>
            <InfoItem
              label={UI_LABELS.transfer.deliveryMode.packedAt}
              value={packedText(transfer)}
            />
            <InfoItem
              label={UI_LABELS.transfer.deliveryMode.goodsLeftAt}
              value={leftText(transfer)}
            />
          </>
        )}
      </div>
      {transfer.rejectionReason && <RejectionNote transfer={transfer} />}
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
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow)">
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
