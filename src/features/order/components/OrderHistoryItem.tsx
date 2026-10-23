"use client";

import { Split, Truck } from "lucide-react";

import {
  ORDER_DELIVERY_MODE_LABELS,
  ORDER_DELIVERY_MODE_UI,
  ORDER_HISTORY_LABELS,
} from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { StatusDot } from "@/components/shared/StatusDot";

import type { OrderHistoryEntry } from "../types";

const L = ORDER_HISTORY_LABELS;

function EntryMeta({ entry }: { entry: OrderHistoryEntry }) {
  return (
    <p className="text-ink-tertiary mt-0.5 text-xs">
      <span className="tabular-nums">{formatDateTime(entry.occurredAt)}</span>
      {entry.actorName && (
        <>
          {" · "}
          {L.by} {entry.actorName}
        </>
      )}
    </p>
  );
}

/** Ghi chú của Sales (hoặc lý do / mã của bước đổi trạng thái). Trống thì không hiện. */
function EntryNote({ entry }: { entry: OrderHistoryEntry }) {
  if (!entry.reason) return null;
  return (
    <p className="text-ink-secondary mt-1 text-[0.8125rem] break-words whitespace-pre-wrap">
      <span className="text-ink-tertiary">{L.noteLabel}: </span>
      {entry.reason}
    </p>
  );
}

function EntryHead({ entry }: { entry: OrderHistoryEntry }) {
  switch (entry.kind) {
    case "partial-shipment":
      // Quyết định của Sales — nổi bật khác hẳn một bước đổi trạng thái (không có from → to)
      return (
        <span className="text-ink-primary inline-flex items-center gap-1.5 font-semibold">
          <Split className="text-accent size-3.5" aria-hidden="true" />
          {entry.allowed ? L.partialAllowed : L.partialStopped}
        </span>
      );
    case "delivery-mode": {
      // Điều phối viên đổi (hoặc chọn lúc release) hình thức giao — BE PR #157, `DELIVERY_MODE_CHANGE`
      const to = ORDER_DELIVERY_MODE_LABELS[entry.mode];
      return (
        <span className="text-ink-primary inline-flex items-center gap-1.5 font-semibold">
          <Truck className="text-accent size-3.5" aria-hidden="true" />
          {entry.previousMode
            ? ORDER_DELIVERY_MODE_UI.historyChanged(
                ORDER_DELIVERY_MODE_LABELS[entry.previousMode],
                to,
              )
            : ORDER_DELIVERY_MODE_UI.historySet(to)}
        </span>
      );
    }
    case "status-change":
      return (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {entry.from ? (
            <>
              <StatusDot domain="order" status={entry.from} />
              <span aria-label={L.statusMoved} className="text-ink-tertiary">
                →
              </span>
            </>
          ) : (
            <span className="text-ink-secondary">{L.placed}</span>
          )}
          <StatusDot domain="order" status={entry.to} />
        </span>
      );
    case "unknown":
      return <span className="text-ink-secondary">{L.unknownEntry}</span>;
  }
}

/** Mục lịch sử nổi bật (quyết định của Sales / đổi hình thức giao) khác một bước đổi trạng thái thuần. */
const HIGHLIGHTED_KINDS: readonly OrderHistoryEntry["kind"][] = [
  "partial-shipment",
  "delivery-mode",
];

/** Một mục của lịch sử đơn: đầu mục theo loại, ai / khi nào, ghi chú. */
export function OrderHistoryItem({ entry }: { entry: OrderHistoryEntry }) {
  return (
    <li
      data-kind={entry.kind}
      className={`rounded-[var(--r-sm)] border p-3 text-[0.8125rem] ${
        HIGHLIGHTED_KINDS.includes(entry.kind)
          ? "border-accent/40 bg-accent/5"
          : "border-border-default"
      }`}
    >
      <EntryHead entry={entry} />
      <EntryMeta entry={entry} />
      <EntryNote entry={entry} />
    </li>
  );
}
