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
      {/* Một hàng: tiêu đề trái — bộ lọc khoảng ngày + "Tính lại" phải (xuống dòng khi hẹp) */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h2 className="text-ink-primary text-base leading-8 font-semibold">
          {REPORTING_LABELS.title}
        </h2>
        <div className="flex flex-wrap items-start justify-end gap-2">
          <SalesRangeFilter range={range} preset={preset} onPreset={setPreset} onRange={setRange} />
          <RebuildAction range={range} />
        </div>
      </div>
      <SalesSummaryCards range={range} />
      <SalesDailyWidget range={range} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <TopProductsWidget range={range} />
        <OrderStatusWidget />
      </div>
    </section>
  );
}
