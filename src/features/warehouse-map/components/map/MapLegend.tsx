"use client";

import {
  BOUNDARY_TYPE_LABELS,
  DOOR_STATUS_LABELS,
  LOCATION_STATUSES,
  UI_LABELS,
} from "@/constants";
import { formatNumber } from "@/lib/format";

import { layoutStats } from "@/features/warehouse-map/selectors";

import { StatusDot } from "@/components/shared/StatusDot";

import type { WarehouseLayout } from "@/features/warehouse-map/types";

const M = UI_LABELS.warehouseMap.map;

/**
 * Chú giải + số liệu của bản đồ (trong modal "?"): số kệ, bin, bin dùng được, khu vực — đếm từ chính
 * layout BE trả (không bịa KPI); trạng thái hiệu lực (màu viền kệ / bin), tường / cửa.
 */
export function MapLegend({ layout }: { layout: WarehouseLayout }) {
  const stats = layoutStats(layout);
  const items: [string, number][] = [
    [M.stats.shelves, stats.shelves],
    [M.stats.bins, stats.bins],
    [M.stats.usableBins, stats.usableBins],
    [M.stats.areas, stats.areas],
  ];
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="border-border-default bg-bg-subtle space-y-0.5 rounded-(--r-sm) border px-3 py-2 text-xs"
          >
            <dt className="text-ink-tertiary">{label}</dt>
            <dd className="text-ink-primary font-[family-name:var(--font-mono)] text-sm font-semibold tabular-nums">
              {formatNumber(value)}
            </dd>
          </div>
        ))}
      </dl>
      <div aria-label={M.legend} className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {LOCATION_STATUSES.map((status) => (
          <StatusDot key={status} domain="location" status={status} />
        ))}
        <span className="text-ink-secondary flex items-center gap-1.5 text-[0.8125rem]">
          <svg viewBox="0 0 16 4" className="h-1 w-4" aria-hidden>
            <line x1={0} x2={16} y1={2} y2={2} className="stroke-ink-primary" strokeWidth={4} />
          </svg>
          {BOUNDARY_TYPE_LABELS.WALL}
        </span>
        <span className="text-ink-secondary flex items-center gap-1.5 text-[0.8125rem]">
          <svg viewBox="0 0 16 4" className="h-1 w-4" aria-hidden>
            <line
              x1={0}
              x2={16}
              y1={2}
              y2={2}
              className="stroke-dot-info"
              strokeWidth={4}
              strokeDasharray="4 2"
            />
          </svg>
          {BOUNDARY_TYPE_LABELS.DOOR} ({DOOR_STATUS_LABELS.OPEN})
        </span>
      </div>
    </div>
  );
}
