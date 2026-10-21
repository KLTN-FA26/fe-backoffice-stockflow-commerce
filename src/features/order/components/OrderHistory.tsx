"use client";

import { History, Split } from "lucide-react";

import { ORDER_HISTORY_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { useOrderHistory } from "../queries";

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

function HistoryBody({ id }: { id: string }) {
  const query = useOrderHistory(id);
  if (query.isError) {
    return (
      <p role="alert" className="text-danger text-[0.8125rem]">
        {L.loadFailed}{" "}
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => void query.refetch()}
        >
          {L.retry}
        </Button>
      </p>
    );
  }
  if (query.isPending) return <p className="text-ink-tertiary text-[0.8125rem]">{L.loading}</p>;
  if (query.data.length === 0) {
    return <p className="text-ink-tertiary text-[0.8125rem]">{L.empty}</p>;
  }
  return (
    <ol className="space-y-3">
      {query.data.map((entry, index) => (
        <li
          key={`${entry.occurredAt}-${index}`}
          data-kind={entry.kind}
          className={`rounded-[var(--r-sm)] border p-3 text-[0.8125rem] ${
            entry.kind === "partial-shipment"
              ? "border-accent/40 bg-accent/5"
              : "border-border-default"
          }`}
        >
          <EntryHead entry={entry} />
          <EntryMeta entry={entry} />
          <EntryNote entry={entry} />
        </li>
      ))}
    </ol>
  );
}

/**
 * Lịch sử đơn (BE `GET /orders/{id}/history`, cũ nhất trước): đổi trạng thái (`STATUS_CHANGE`) xen với quyết
 * định giao một phần của Sales (`PARTIAL_SHIPMENT_DECISION`, BE PR #150) — mục sau render riêng: "Bật / Tắt giao
 * một phần", ai, khi nào, ghi chú. Chỉ vẽ khi người xem đọc được đơn (cha kiểm quyền).
 */
export function OrderHistory({ orderId }: { orderId: string }) {
  return (
    <section
      aria-label={L.title}
      className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]"
    >
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <History className="text-accent size-4" />
        {L.title}
      </h2>
      <HistoryBody id={orderId} />
    </section>
  );
}
