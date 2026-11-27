"use client";

import { PRODUCTION_LABELS, PRODUCTION_ORDER_STATUS_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";

import { DETAIL_CARD_CLASS, DetailCardTitle } from "@/components/shared/DetailSection";

import { actorLabel } from "./GeneralCard";

import type { ProductionOrderHistoryEntry } from "@/features/production-order/types";

const L = PRODUCTION_LABELS.detail;

/** Lịch sử trạng thái (BE `history`, mới nhất trên cùng): từ → tới, lý do, ai (vắng = hệ thống), lúc nào. */
export function HistoryCard({
  history,
  me,
}: {
  history: readonly ProductionOrderHistoryEntry[];
  me: string | null | undefined;
}) {
  const entries = [...history].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <section className={DETAIL_CARD_CLASS} aria-label={L.history}>
      <DetailCardTitle>{L.history}</DetailCardTitle>
      {entries.length === 0 ? (
        <p className="text-ink-tertiary text-xs">{L.historyEmpty}</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((entry) => (
            <li
              key={`${entry.at}-${entry.to}`}
              className="border-border-default border-l-2 pl-3 text-[0.8125rem]"
            >
              <p className="text-ink-primary font-medium">
                {entry.from ? `${PRODUCTION_ORDER_STATUS_LABELS[entry.from]} → ` : ""}
                {PRODUCTION_ORDER_STATUS_LABELS[entry.to]}
              </p>
              {entry.reason && (
                <p className="text-ink-secondary whitespace-pre-line">{entry.reason}</p>
              )}
              <p className="text-ink-tertiary text-xs tabular-nums">
                {actorLabel(entry.by, me, entry.byName)} · {formatDateTime(entry.at)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
