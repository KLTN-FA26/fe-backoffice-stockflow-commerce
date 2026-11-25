"use client";

import { UI_LABELS } from "@/constants";

import { routeMarkerPoint } from "../../route-line";

import type { RouteBinTarget, RouteMapStop, RouteStopState } from "../../route-line";

const R = UI_LABELS.warehouseMap.route;

const DOT_CLASS: Record<RouteStopState, { dot: string; text: string }> = {
  done: { dot: "fill-dot-positive stroke-bg-surface", text: "fill-ink-inverse" },
  next: { dot: "fill-dot-info stroke-bg-surface", text: "fill-ink-inverse" },
  todo: { dot: "fill-bg-surface stroke-dot-info", text: "fill-ink-primary" },
};
/**
 * Ô bin cần đặt — phải nổi trên nền kệ, mà nền kệ là màu zone (thường xanh nhạt): ô nên tới tiếp tô đặc + viền đậm,
 * ô còn lại nền vừa + viền dày, ô đã cất xanh lá. Tô nhạt (< 40%) sẽ lẫn vào kệ zone xanh.
 */
const BIN_CLASS: Record<
  RouteStopState,
  { className: string; fillOpacity: number; stroke: number }
> = {
  done: { className: "fill-dot-positive stroke-dot-positive", fillOpacity: 0.6, stroke: 0.2 },
  next: { className: "fill-dot-info stroke-ink-primary", fillOpacity: 0.9, stroke: 0.3 },
  todo: { className: "fill-dot-info stroke-dot-info", fillOpacity: 0.4, stroke: 0.35 },
};

/** Một điểm dừng: ô bin cần đặt tô trên kệ (nếu là bin) + chấm số nhỏ ở lối đi cạnh ô, `dx` = độ dời khi trùng điểm đứng. */
export function RouteStopMarker({
  stop,
  bin,
  mark,
}: {
  stop: RouteMapStop & { dx: number };
  bin: RouteBinTarget | null;
  mark: number;
}) {
  const r = stop.state === "next" ? mark * 1.15 : mark;
  // Chấm nằm ở lối đi, sát mép kệ (điểm đứng BE nằm ngay trên mặt kệ); trùng điểm đứng thì dời ngang thêm `dx`
  const at = routeMarkerPoint(stop, bin?.center ?? null, r * 1.1);
  const cx = at.x + stop.dx;
  return (
    <g role="img" aria-label={R.stop(stop.sequence, stop.locationCode, stop.state)}>
      {bin && (
        <rect
          data-route-bin={stop.locationCode}
          transform={bin.transform}
          x={bin.x}
          y={bin.y}
          width={bin.width}
          height={bin.height}
          rx={0.1}
          className={BIN_CLASS[stop.state].className}
          fillOpacity={BIN_CLASS[stop.state].fillOpacity}
          strokeWidth={mark * BIN_CLASS[stop.state].stroke}
        />
      )}
      <circle
        cx={cx}
        cy={at.y}
        r={r}
        className={DOT_CLASS[stop.state].dot}
        strokeWidth={mark * 0.25}
      />
      <text
        x={cx}
        y={at.y}
        fontSize={r * 1.25}
        fontWeight={600}
        textAnchor="middle"
        dominantBaseline="central"
        className={`${DOT_CLASS[stop.state].text} tabular-nums`}
      >
        {stop.sequence}
      </text>
    </g>
  );
}
