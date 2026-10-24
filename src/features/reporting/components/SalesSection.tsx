"use client";

import { REPORTING_LABELS, REPORTING_READ_PERMISSION } from "@/constants/reporting";

import { useCan } from "@/lib/auth";

import { RebuildAction } from "./RebuildAction";
import { SalesRangeFilter } from "./SalesRangeFilter";
import { SalesSummaryCards } from "./SalesSummaryCards";
import { OrderStatusWidget, SalesDailyWidget, TopProductsWidget } from "./SalesWidgets";
import { useSalesRange } from "./useSalesRange";

/**
 * "Doanh số" on the dashboard: summary, per-day combo chart, top SKUs, orders by status — one shared
 * date range kept in the URL. Hidden entirely without `reporting-reports:READ` (UI-only gating —
 * Backend phải re-check @RequiresPermission), so no request is sent and no 403 shows.
 */
export function SalesSection() {
  const canRead = useCan(REPORTING_READ_PERMISSION);
  const { range, preset, setPreset, setRange } = useSalesRange();
  if (!canRead) return null;
  return (
    <section aria-label={REPORTING_LABELS.title} className="mb-6 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-ink-primary text-base font-semibold">{REPORTING_LABELS.title}</h2>
        <RebuildAction range={range} />
      </div>
      <SalesRangeFilter range={range} preset={preset} onPreset={setPreset} onRange={setRange} />
      <SalesSummaryCards range={range} />
      <SalesDailyWidget range={range} />
      <div className="grid gap-3 lg:grid-cols-2">
        <TopProductsWidget range={range} />
        <OrderStatusWidget />
      </div>
    </section>
  );
}
