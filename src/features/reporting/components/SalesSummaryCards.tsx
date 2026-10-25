"use client";

import { Banknote, ReceiptText, ShoppingBag } from "lucide-react";

import { REPORTING_LABELS } from "@/constants/reporting";

import { formatMoney, formatNumber } from "@/lib/format";

import { Skeleton } from "@/components/shared/Skeleton";
import { StatCell, StatStrip } from "@/components/shared/StatStrip";
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
const ICONS = { revenue: Banknote, orders: ShoppingBag, averageOrderValue: ReceiptText } as const;
const TONES = { revenue: "positive", orders: "info", averageOrderValue: "special" } as const;

function direction(change: number) {
  if (change > 0) return "up" as const;
  if (change < 0) return "down" as const;
  return "flat" as const;
}

/** Revenue / orders / average order value with the change against the previous period. */
export function SalesSummaryCards({ range }: { range: DateRange }) {
  const query = useSalesSummary(range, true);
  if (query.isPending) {
    return <Skeleton className="h-[66px] rounded-[var(--card-radius)]" aria-busy="true" />;
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
    <StatStrip className="grid-cols-1 sm:grid-cols-3">
      {summaryCards(query.data).map((card) => (
        <StatCell
          key={card.key}
          label={LABELS[card.key]}
          icon={ICONS[card.key]}
          tone={TONES[card.key]}
          mono={card.key !== "orders"}
          value={
            card.key === "orders" ? formatNumber(card.value) : formatMoney(card.value, currency)
          }
          delta={
            card.change === undefined
              ? undefined
              : {
                  text: formatChange(card.change),
                  hint: L.changeVsPrevious,
                  direction: direction(card.change),
                }
          }
        />
      ))}
    </StatStrip>
  );
}
