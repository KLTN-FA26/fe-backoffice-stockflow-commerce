"use client";

import { RETURN_LABELS } from "@/constants/labels-return";
import { RETURN_API_STATUSES } from "@/constants/returns";
import { Card } from "@/components/shared/Card";

import { ReturnStatusDot, When } from "./primitives";

import type { ReturnApiStatus } from "@/constants/returns";
import type { ReturnHistoryEntry } from "../types";

const D = RETURN_LABELS.detail;
const isStatus = (value: string): value is ReturnApiStatus =>
  (RETURN_API_STATUSES as readonly string[]).includes(value);

/** Lịch sử trạng thái (BE `ReturnRequestResponse.history`), cũ nhất trước như BE trả. */
export function ReturnHistoryCard({ history }: { history: readonly ReturnHistoryEntry[] }) {
  return (
    <Card className="space-y-3">
      <h2 className="text-ink-primary text-sm font-semibold">{D.history}</h2>
      {history.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">{D.noHistory}</p>
      ) : (
        <ol className="divide-y divide-[var(--table-line)] text-[0.8125rem]">
          {history.map((entry, index) => (
            <li
              key={`${entry.occurredAt}-${index}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5"
            >
              <When iso={entry.occurredAt} />
              {isStatus(entry.to) ? <ReturnStatusDot status={entry.to} /> : <span>{entry.to}</span>}
              {entry.reason && <span className="text-ink-secondary">{entry.reason}</span>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
