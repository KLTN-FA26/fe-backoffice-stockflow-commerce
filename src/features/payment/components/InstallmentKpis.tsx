"use client";

import { CalendarClock, CalendarDays, CalendarX2 } from "lucide-react";

import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_ROUTES } from "@/constants/payment";
import { addDays } from "@/lib/date-range";
import { StatCell, StatStrip } from "@/components/shared/StatStrip";

import { todayInVietnam } from "../input-schemas";
import { useInstallments } from "../queries";

import type { ListInstallmentParams } from "../api";

const K = PAYMENT_LABELS.installments.kpis;
const EMPTY = "—";

/**
 * Ba con số đầu trang đợt thanh toán (bo-22): đến hạn hôm nay, đến hạn trong 7 ngày (hôm nay tới hết ngày thứ 7), quá
 * hạn — đều là đợt đã đến mốc còn nợ (`owing=true`). Mỗi số là `totalElements` của một trang 1 dòng của chính
 * `GET /installments` (BE `dueBefore` là "trước ngày", loại trừ; `overdue=false` = chưa quá hạn, tức hạn ≥ hôm nay),
 * nên không phải tải mọi trang. Bấm một ô → danh sách lọc đúng các đợt đó.
 */
export function useInstallmentKpis(canRead: boolean, today: string = todayInVietnam()) {
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);
  const options = { enabled: canRead };
  const dueToday = useInstallments(countOf({ overdue: false, dueBefore: tomorrow }), options);
  const dueWeek = useInstallments(countOf({ overdue: false, dueBefore: weekEnd }), options);
  const overdue = useInstallments(countOf({ overdue: true }), options);
  return {
    dueToday: { query: dueToday, dueBefore: tomorrow },
    dueWeek: { query: dueWeek, dueBefore: weekEnd },
    overdue: { query: overdue },
  };
}

/** Một trang 1 dòng của đợt đã đến mốc còn nợ — chỉ đọc `totalElements`. */
function countOf(params: ListInstallmentParams): ListInstallmentParams {
  return { page: 0, size: 1, owing: true, ...params };
}

function owingLink(params: Record<string, string>): string {
  return `${PAYMENT_ROUTES.installments.list}?${new URLSearchParams({ owing: "true", ...params })}`;
}

export function InstallmentKpis({ canRead }: { canRead: boolean }) {
  const kpis = useInstallmentKpis(canRead);
  if (!canRead) return null;
  const value = (query: { data?: { totalElements: number } }) =>
    query.data ? query.data.totalElements : EMPTY;
  const title = (query: { isError: boolean }) => (query.isError ? K.unavailable : undefined);
  return (
    <section aria-label={K.label} className="mb-3">
      <StatStrip columns="grid-cols-3">
        <StatCell
          label={K.dueToday}
          icon={CalendarClock}
          tone="warning"
          value={value(kpis.dueToday.query)}
          title={title(kpis.dueToday.query)}
          href={owingLink({ overdue: "false", dueBefore: kpis.dueToday.dueBefore })}
        />
        <StatCell
          label={K.dueWeek}
          icon={CalendarDays}
          tone="info"
          value={value(kpis.dueWeek.query)}
          title={title(kpis.dueWeek.query)}
          href={owingLink({ overdue: "false", dueBefore: kpis.dueWeek.dueBefore })}
        />
        <StatCell
          label={K.overdue}
          icon={CalendarX2}
          tone="danger"
          value={value(kpis.overdue.query)}
          title={title(kpis.overdue.query)}
          href={owingLink({ overdue: "true" })}
        />
      </StatStrip>
    </section>
  );
}
