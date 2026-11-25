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
/** Ô bin cần đặt: tô đậm ô nên tới tiếp, nhạt ô còn lại, xanh lá ô đã cất xong. */
const BIN_CLASS: Record<RouteStopState, { className: string; fillOpacity: number }> = {
  done: { className: "fill-dot-positive stroke-dot-positive", fillOpacity: 0.3 },
  next: { className: "fill-dot-info stroke-dot-info", fillOpacity: 0.45 },
  todo: { className: "fill-dot-info stroke-dot-info", fillOpacity: 0.18 },
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
          strokeWidth={mark * 0.18}
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
