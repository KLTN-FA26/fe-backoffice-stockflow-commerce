"use client";

import { useMemo } from "react";

import { UI_LABELS } from "@/constants";

import { walkRoute } from "../../walk-path";

import type { WalkGrid } from "../../walk-grid";

const R = UI_LABELS.warehouseMap.route;
/**
 * Bán kính chấm theo cỡ kho: SVG vẽ theo mét nên kho càng lớn chấm càng nhỏ trên màn — lấy 1/60 cạnh dài (kho 60 m
 * → 1 m: chấm ≈ 18px, số ≈ 11px ở khung 420px, đo 1440px) để số thứ tự đọc được ở zoom vừa khung.
 */
const dotFor = (mapExtent: number) => Math.max(0.5, mapExtent / 60);

export type RouteStopState = "done" | "next" | "todo";

export interface RouteMapPath {
  start: { locationCode: string | null; x: number; y: number } | null;
  stops: readonly {
    sequence: number;
    locationCode: string;
    x: number;
    y: number;
    state: RouteStopState;
  }[];
}

const DOT_CLASS: Record<RouteStopState, { dot: string; text: string }> = {
  done: { dot: "fill-dot-positive stroke-bg-surface", text: "fill-ink-inverse" },
  next: { dot: "fill-dot-info stroke-bg-surface", text: "fill-ink-inverse" },
  todo: { dot: "fill-bg-surface stroke-dot-info", text: "fill-ink-primary" },
};

/** Dời các điểm trùng toạ độ sang ngang theo thứ tự xuất hiện. */
function spread<T extends { x: number; y: number }>(
  points: readonly T[],
  nudge: number,
): (T & { dx: number })[] {
  const seen = new Map<string, number>();
  return points.map((point) => {
    const key = `${point.x},${point.y}`;
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    return { ...point, dx: count * nudge };
  });
}

/**
 * Lộ trình chuyến cất vẽ chồng lên mặt bằng 2D (docs 05 §4.5 bước 14): đường từ khu nguồn qua các điểm dừng theo đúng
 * thứ tự BE sắp (BR-17), chấm đánh số khớp danh sách điểm dừng. Có `grid` thì mỗi chặng vòng qua kệ / tường / cửa đóng
 * (FE ước lượng từ bản đồ — ⚠️ C46: kho chưa khai báo lối đi), chặng không tìm được lối vẽ thẳng. Chỉ để định hướng.
 * Không nhận chuột: bấm kệ / khu bên dưới vẫn được.
 */
export function RouteOverlay({
  path,
  mapExtent,
  grid,
}: {
  path: RouteMapPath;
  mapExtent: number;
  /** Mặt bằng đi được (`buildWalkGrid`); vắng → nối thẳng các điểm. */
  grid?: WalkGrid | null;
}) {
  const dot = dotFor(mapExtent);
  // Hai điểm dừng trùng điểm đứng (bin khác tầng cùng cột) → dời ngang để không che nhau
  const stops = spread(path.stops, dot * 2.2);
  // Tìm đường cho cả lộ trình (A* từng chặng) — nhớ theo lưới + lộ trình để zoom / dời bản đồ không tính lại
  const points = useMemo(() => {
    // Đi giữa các điểm đứng thật, không phải vị trí chấm đã dời (chấm dời có thể rơi vào trong kệ)
    const route = [...(path.start ? [path.start] : []), ...path.stops].map(({ x, y }) => ({
      x,
      y,
    }));
    return (grid ? walkRoute(grid, route) : route).map((p) => `${p.x},${p.y}`);
  }, [grid, path]);
  return (
    <g className="pointer-events-none">
      {points.length > 1 && (
        <>
          <polyline
            points={points.join(" ")}
            className="stroke-bg-surface fill-none"
            strokeWidth={dot * 0.9}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <polyline
            points={points.join(" ")}
            className="stroke-dot-info fill-none"
            strokeWidth={dot * 0.4}
            strokeDasharray={`${dot * 1.1} ${dot * 0.6}`}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </>
      )}
      {path.start && (
        <rect
          role="img"
          aria-label={R.start(path.start.locationCode)}
          x={path.start.x - dot * 0.8}
          y={path.start.y - dot * 0.8}
          width={dot * 1.6}
          height={dot * 1.6}
          rx={0.15}
          className="fill-ink-primary stroke-bg-surface"
          strokeWidth={dot * 0.25}
        />
      )}
      {stops.map((stop) => (
        <g
          key={stop.sequence}
          role="img"
          aria-label={R.stop(stop.sequence, stop.locationCode, stop.state)}
        >
          <circle
            cx={stop.x + stop.dx}
            cy={stop.y}
            r={stop.state === "next" ? dot * 1.2 : dot}
            className={DOT_CLASS[stop.state].dot}
            strokeWidth={dot * 0.3}
          />
          <text
            x={stop.x + stop.dx}
            y={stop.y}
            fontSize={dot * 1.2}
            fontWeight={600}
            textAnchor="middle"
            dominantBaseline="central"
            className={`${DOT_CLASS[stop.state].text} tabular-nums`}
          >
            {stop.sequence}
          </text>
        </g>
      ))}
    </g>
  );
}
