"use client";

import { cn } from "cn";

import { UI_LABELS } from "@/constants";

import { capacitySegments } from "@/features/warehouse-capacity/selectors";

import { Card } from "@/components/shared/Card";

import { formatM3, formatM3Unit, TONE_FILL } from "../parts";

import type { CapacitySegment } from "@/features/warehouse-capacity/selectors";
import type { CapacityBoard } from "@/features/warehouse-capacity/types";

const L = UI_LABELS.warehouseCapacity;

/**
 * Màu từng phần: Đang chiếm `info`, Sắp về `special` (đỏ dành cho phần vượt sức chứa), Chờ duyệt `warning` vẽ nhạt —
 * đơn chưa chắc được gửi nên không trừ vào còn trống dự kiến (docs 06 §4.6 bước 3).
 */
const SEGMENT: Record<CapacitySegment["key"], { fill: string; label: string }> = {
  occupied: { fill: TONE_FILL.info, label: L.metric.occupied },
  incoming: { fill: TONE_FILL.special, label: L.metric.incoming },
  pending: { fill: `${TONE_FILL.warning} opacity-50`, label: L.metric.pending },
};

/**
 * Thanh phân bổ Sức chứa: Đang chiếm → Sắp về → Chờ duyệt nối nhau; vạch đứng là mốc Sức chứa. Tổng vượt sức chứa
 * thì thang giãn theo tổng và hiện phần vượt (BR-21 — chỉ cảnh báo, hàng về vẫn được nhận vào OVERFLOW).
 */
export function CapacityBreakdown({ board }: { board: CapacityBoard }) {
  const { segments, capacityMark, overflowM3 } = capacitySegments(board);
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-ink-primary text-sm font-medium">{L.barLegend}</h2>
        <p className="text-ink-tertiary text-xs">
          {overflowM3 > 0 ? (
            <span className="text-danger font-medium">{L.overCapacity(formatM3(overflowM3))}</span>
          ) : (
            `${L.metric.capacity} ${formatM3Unit(board.capacityM3)}`
          )}
        </p>
      </div>
      <div className="relative">
        <div
          role="img"
          aria-label={segments
            .map((s) => `${SEGMENT[s.key].label} ${formatM3Unit(s.m3)}`)
            .join(", ")}
          className="bg-bg-muted flex h-3 w-full overflow-hidden rounded-full"
        >
          {segments.map((s) => (
            <div
              key={s.key}
              className={cn("h-full", SEGMENT[s.key].fill)}
              style={{ width: `${s.width}%` }}
            />
          ))}
        </div>
        {capacityMark > 0 && capacityMark < 100 && (
          <div
            aria-hidden
            className="bg-ink-primary absolute -top-1 h-5 w-0.5 rounded-full"
            style={{ left: `${capacityMark}%` }}
          />
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((s) => (
          <li key={s.key} className="text-ink-secondary flex items-center gap-1.5 text-xs">
            <span aria-hidden className={cn("size-2.5 rounded-full", SEGMENT[s.key].fill)} />
            {SEGMENT[s.key].label}
            <span className="text-ink-primary font-mono tabular-nums">{formatM3Unit(s.m3)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
