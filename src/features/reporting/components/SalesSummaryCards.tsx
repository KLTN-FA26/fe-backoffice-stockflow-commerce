"use client";

import { REPORTING_LABELS } from "@/constants/reporting";

import { formatMoney, formatNumber } from "@/lib/format";

import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import { useSalesSummary } from "../queries";
import { formatChange, summaryCards } from "../selectors";

import type { DateRange } from "@/lib/date-range";

const L = REPORTING_LABELS;
const CARD =
  "border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-[var(--card-shadow)]";
const LABELS = {
  revenue: L.revenue,
  orders: L.orders,
  averageOrderValue: L.averageOrderValue,
} as const;

/** Revenue / orders / average order value with the change against the previous period. */
export function SalesSummaryCards({ range }: { range: DateRange }) {
  const query = useSalesSummary(range, true);
  if (query.isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-3" aria-busy="true">
        {Object.keys(LABELS).map((key) => (
          <Skeleton key={key} className="h-[92px] rounded-[var(--card-radius)]" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <div role="alert" className={`${CARD} text-danger flex items-center gap-2 text-sm`}>
        {L.loadError}
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => void query.refetch()}
        >
          {L.retry}
        </Button>
      </div>
    );
  }
  const { currency } = query.data;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {summaryCards(query.data).map((card) => (
        <div key={card.key} className={CARD}>
          <p className="text-ink-secondary text-xs">{LABELS[card.key]}</p>
          <p className="text-ink-primary mt-1 font-mono text-xl font-semibold tabular-nums">
            {card.key === "orders" ? formatNumber(card.value) : formatMoney(card.value, currency)}
          </p>
          {card.change !== undefined && (
            <p
              className={`mt-1 text-xs tabular-nums ${card.change < 0 ? "text-danger" : "text-positive"}`}
            >
              {formatChange(card.change)} {L.changeVsPrevious}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
