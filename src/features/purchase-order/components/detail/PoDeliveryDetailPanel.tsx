"use client";

import { PO_DELIVERY_ATTEMPT_STATUS, UI_LABELS } from "@/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { deliveryFailureName, deliveryRound } from "@/features/purchase-order";
import { SlideOverPanel } from "@/components/shared/SlideOverPanel";
import { StatusDot } from "@/components/shared/StatusDot";

import { attemptResult, channelLabel, decisionTypeLabel, templateLabel } from "./delivery-labels";

import type { DeliveryAttempt, DeliveryDecision } from "@/features/purchase-order";
import type { ReactNode } from "react";

export type DeliveryDetail =
  { kind: "attempt"; row: DeliveryAttempt } | { kind: "decision"; row: DeliveryDecision };

const NUM = "tabular-nums";
const MONO_NUM = "font-[family-name:var(--font-mono)] tabular-nums";
const EMPTY = <span className="text-ink-tertiary">—</span>;
const orEmpty = (v: string | null | undefined) => (v ? v : EMPTY);
const dateTime = (v: string | null | undefined) =>
  v ? <span className={NUM}>{formatDateTime(v)}</span> : EMPTY;
const date = (v: string | null | undefined) =>
  v ? <span className={NUM}>{formatDate(v)}</span> : EMPTY;
const yesNo = (v: boolean) => (v ? "Có" : "Không");

/** Chi tiết 1 dòng lịch sử gửi NCC — đủ mọi field BE trả, trừ `id`. */
export function PoDeliveryDetailPanel({
  detail,
  onClose,
}: {
  detail: DeliveryDetail | null;
  onClose: () => void;
}) {
  const round = detail ? deliveryRound(detail.row.generation) : 0;
  return (
    <SlideOverPanel
      open={detail !== null}
      onClose={onClose}
      title={
        detail?.kind === "decision" ? `Quyết định gửi · lượt ${round}` : `Lần gửi · lượt ${round}`
      }
      subtitle={detail?.kind === "decision" ? decisionTypeLabel(detail.row.generation) : undefined}
      badge={
        detail?.kind === "attempt" ? (
          <StatusDot domain="po" status={detail.row.status} size="sm" withIcon />
        ) : undefined
      }
    >
      {detail && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[0.8125rem]">
          {detail.kind === "attempt" ? <AttemptRows row={detail.row} /> : null}
          {detail.kind === "decision" ? <DecisionRows row={detail.row} /> : null}
        </dl>
      )}
    </SlideOverPanel>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="text-ink-primary min-w-0 break-words whitespace-pre-wrap">{children}</dd>
    </>
  );
}

function AttemptRows({ row }: { row: DeliveryAttempt }) {
  return (
    <>
      <Row label="Lượt">
        <span className={MONO_NUM}>{deliveryRound(row.generation)}</span>
      </Row>
      <Row label={UI_LABELS.purchaseOrder.delivery.result}>
        <StatusDot domain="po" status={attemptResult(row.status)} size="sm" withIcon />
      </Row>
      {row.templateCode && (
        <Row label={UI_LABELS.purchaseOrder.templateLabel}>{templateLabel(row.templateCode)}</Row>
      )}
      <Row label="Kênh">{channelLabel(row.channel)}</Row>
      <Row label={UI_LABELS.purchaseOrder.delivery.recipient}>{orEmpty(row.recipient)}</Row>
      <Row label={UI_LABELS.purchaseOrder.delivery.attemptedAt}>{dateTime(row.attemptedAt)}</Row>
      <Row label={UI_LABELS.purchaseOrder.delivery.deliveredAt}>{dateTime(row.sentAt)}</Row>
      {row.status === PO_DELIVERY_ATTEMPT_STATUS.FAILED && (
        <Row label="Lỗi kỹ thuật">
          <span className="text-danger">{deliveryFailureName(row.failure) ?? "—"}</span>
        </Row>
      )}
    </>
  );
}

function DecisionRows({ row }: { row: DeliveryDecision }) {
  return (
    <>
      <Row label="Lượt">
        <span className={MONO_NUM}>{deliveryRound(row.generation)}</span>
      </Row>
      <Row label="Loại">{decisionTypeLabel(row.generation)}</Row>
      <Row label={UI_LABELS.purchaseOrder.delivery.actor}>{orEmpty(row.actor)}</Row>
      <Row label={UI_LABELS.purchaseOrder.delivery.requestedAt}>{dateTime(row.requestedAt)}</Row>
      <Row label="Ngày giao cũ">{date(row.previousExpectedAt)}</Row>
      <Row label="Ngày giao mới">{date(row.expectedAt)}</Row>
      <Row label="Lý do">{orEmpty(row.reason)}</Row>
      <Row label="Đã đối chiếu với NCC">{yesNo(row.reconciled)}</Row>
      <Row label="Xác nhận ngày giao đã qua">{yesNo(row.acknowledgePastDue)}</Row>
      <Row label="Kênh">{channelLabel(row.channel)}</Row>
      <Row label={UI_LABELS.purchaseOrder.delivery.recipient}>{orEmpty(row.recipient)}</Row>
    </>
  );
}
