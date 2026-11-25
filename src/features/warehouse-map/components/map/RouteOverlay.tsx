"use client";

import { UI_LABELS } from "@/constants";

import { routeLine, routeOrigin } from "../../route-line";

import type { RouteMapPath, RouteStopState } from "../../route-line";

export type { RouteMapPath, RouteStopState } from "../../route-line";

const R = UI_LABELS.warehouseMap.route;
/**
 * Bán kính chấm theo cỡ kho: SVG vẽ theo mét nên kho càng lớn chấm càng nhỏ trên màn — lấy 1/60 cạnh dài (kho 60 m
 * → 1 m: chấm ≈ 18px, số ≈ 11px ở khung 420px, đo 1440px) để số thứ tự đọc được ở zoom vừa khung.
 */
const dotFor = (mapExtent: number) => Math.max(0.5, mapExtent / 60);
/**
 * Độ dày đường theo bán kính chấm. Đường đi BE chạy sát mặt kệ (điểm đứng cách kệ 0,5 m) nên phải mảnh: kho 90 m →
 * viền trắng ~0,5 m, nét xanh ~0,27 m — dày hơn thì che mất chữ / ô bin của kệ cạnh lối.
 */
const LINE = { halo: 0.35, stroke: 0.18, dash: 0.8, gap: 0.5 } as const;

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
 * Lộ trình chuyến cất vẽ chồng lên mặt bằng 2D (docs 05 §4.5 bước 14): đường đi BE tính cho từng chặng, vòng qua kệ /
 * tường / cửa đóng (BE #410), theo đúng thứ tự BE sắp (BR-17); chặng BE không có đường thì nối thẳng (⚠️ C46 — ước
 * lượng từ bản đồ, chỉ để định hướng). Chấm đánh số khớp danh sách điểm dừng. Không nhận chuột: bấm kệ / khu bên dưới
 * vẫn được.
 */
export function RouteOverlay({ path, mapExtent }: { path: RouteMapPath; mapExtent: number }) {
  const dot = dotFor(mapExtent);
  // Hai điểm dừng trùng điểm đứng (bin khác tầng cùng cột) → dời ngang chấm để không che nhau; đường vẫn đi qua điểm
  // đứng thật (chấm dời có thể nằm trên kệ)
  const stops = spread(path.stops, dot * 2.2);
  const points = routeLine(path).map((p) => `${p.x},${p.y}`);
  const origin = routeOrigin(path);
  return (
    <g className="pointer-events-none">
      {points.length > 1 && (
        <>
          <polyline
            points={points.join(" ")}
            className="stroke-bg-surface fill-none"
            strokeWidth={dot * LINE.halo}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <polyline
            points={points.join(" ")}
            className="stroke-dot-info fill-none"
            strokeWidth={dot * LINE.stroke}
            strokeDasharray={`${dot * LINE.dash} ${dot * LINE.gap}`}
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
      {origin && (
        <circle
          role="img"
          aria-label={R.origin(origin.locationCode)}
          cx={origin.x}
          cy={origin.y}
          r={dot * 0.6}
          className="fill-bg-surface stroke-ink-primary"
          strokeWidth={dot * 0.3}
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
