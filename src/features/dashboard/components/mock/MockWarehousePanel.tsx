/**
 * MOCK ONLY — rendered solely when `useIsMock()` is true (see `MockDashboardPanels`). The data of
 * this widget exists only in the demo dataset; the backend has no endpoint for it.
 */
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "cn";
import { ArrowRight, Warehouse } from "lucide-react";

import { warehouseKpis } from "@/lib/mock-data";

function computeWarehouseStats() {
  return warehouseKpis.map((kpi) => ({
    warehouseId: kpi.warehouseId,
    utilization: Math.round(kpi.utilizationPct * 100),
    honeycombing: Math.round(kpi.honeycombingPct * 100),
    overloaded: kpi.overloadedLocations,
    empty: kpi.emptyLocations,
    blocked: kpi.blockedLocations,
    pendingPutaway: kpi.pendingPutaway,
    openPicks: kpi.openPickTasks,
  }));
}

export function MockWarehousePanel() {
  const whStats = useMemo(() => computeWarehouseStats(), []);
  return (
    <div className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-[var(--card-shadow)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Warehouse className="text-accent size-4" />
          <h2 className="text-ink-primary text-[0.875rem] font-semibold">Hiệu suất kho hôm nay</h2>
        </div>
        <Link
          href="/admin/warehouse-map"
          className="text-accent flex items-center gap-1 text-xs font-medium hover:underline"
        >
          Xem chi tiết <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="space-y-3">
        {whStats.map((wh) => {
          const whName =
            wh.warehouseId === "WH-HN-01"
              ? "HN01"
              : wh.warehouseId === "WH-HCM-01"
                ? "HCM01"
                : "DN01";
          return (
            <div
              key={wh.warehouseId}
              className="border-border-default rounded-[var(--r-sm)] border p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-semibold">
                  {whName}
                </span>
                <span className="text-ink-tertiary text-xs">
                  Sử dụng{" "}
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      wh.utilization > 80
                        ? "text-danger"
                        : wh.utilization > 60
                          ? "text-warning"
                          : "text-positive",
                    )}
                  >
                    {wh.utilization}%
                  </span>
                </span>
              </div>
              {/* Progress bar */}
              <div className="bg-bg-subtle mb-2 h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    wh.utilization > 80
                      ? "bg-danger"
                      : wh.utilization > 60
                        ? "bg-warning"
                        : "bg-positive",
                  )}
                  style={{ width: `${wh.utilization}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-ink-tertiary">Trống</span>
                  <span className="text-ink-primary ml-1 font-semibold tabular-nums">
                    {wh.empty}
                  </span>
                </div>
                <div>
                  <span className="text-ink-tertiary">Quá tải</span>
                  <span
                    className={cn(
                      "ml-1 font-semibold tabular-nums",
                      wh.overloaded > 0 ? "text-danger" : "text-ink-primary",
                    )}
                  >
                    {wh.overloaded}
                  </span>
                </div>
                <div>
                  <span className="text-ink-tertiary">Chặn</span>
                  <span
                    className={cn(
                      "ml-1 font-semibold tabular-nums",
                      wh.blocked > 0 ? "text-warning" : "text-ink-primary",
                    )}
                  >
                    {wh.blocked}
                  </span>
                </div>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-ink-tertiary">Chờ cất</span>
                  <span className="text-ink-primary ml-1 font-semibold tabular-nums">
                    {wh.pendingPutaway}
                  </span>
                </div>
                <div>
                  <span className="text-ink-tertiary">Pick mở</span>
                  <span className="text-ink-primary ml-1 font-semibold tabular-nums">
                    {wh.openPicks}
                  </span>
                </div>
                <div>
                  <span className="text-ink-tertiary">Honeycombing</span>
                  <span className="text-ink-primary ml-1 font-semibold tabular-nums">
                    {wh.honeycombing}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
