"use client";

import { UI_LABELS } from "@/constants";

import { routeBinTarget, routeLine, routeOrigin } from "../../route-line";
import { RouteStopMarker } from "./RouteStopMarker";

import type { RouteMapPath } from "../../route-line";
import type { LayoutShelf } from "../../types";

export type { RouteMapPath, RouteStopState } from "../../route-line";

const R = UI_LABELS.warehouseMap.route;
/** Đơn vị vẽ theo cỡ kho: SVG vẽ theo mét nên kho càng lớn nét càng nhỏ trên màn — lấy 1/60 cạnh dài (kho 60 m → 1 m). */
const unitFor = (mapExtent: number) => Math.max(0.5, mapExtent / 60);
/**
 * Kích thước theo đơn vị. Đường đi BE chạy sát mặt kệ (BE #446) nên nét phải mảnh — kho 90 m → viền trắng ~0,5 m, nét
 * xanh ~0,27 m. Chấm số nhỏ (~0,8 m bán kính ở kho 90 m) vì ô bin tô trên kệ mới là chỗ đặt; chấm chỉ để đọc thứ tự.
 */
const SIZE = { halo: 0.35, stroke: 0.18, dash: 0.8, gap: 0.5, mark: 0.5 } as const;

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
 * lượng từ bản đồ, chỉ để định hướng). Mỗi điểm dừng tô ô bin cần đặt trên kệ + chấm số nhỏ ở điểm đứng, khớp danh
 * sách điểm dừng. Không nhận chuột: bấm kệ / khu bên dưới vẫn được.
 */
export function RouteOverlay({
  path,
  mapExtent,
  shelves = [],
}: {
  path: RouteMapPath;
  mapExtent: number;
  shelves?: readonly Pick<LayoutShelf, "footprint" | "levels">[];
}) {
  const unit = unitFor(mapExtent);
  const mark = unit * SIZE.mark;
  // Hai điểm dừng trùng điểm đứng (bin khác tầng cùng cột) → dời ngang chấm để không che nhau; đường vẫn đi qua điểm
  // đứng thật
  const stops = spread(path.stops, mark * 2.4);
  const points = routeLine(path)
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
  const origin = routeOrigin(path);
  const line = { strokeLinejoin: "round", strokeLinecap: "round", fill: "none" } as const;
  return (
    <g className="pointer-events-none">
      {points.includes(" ") && (
        <>
          <polyline
            points={points}
            className="stroke-bg-surface"
            strokeWidth={unit * SIZE.halo}
            {...line}
          />
          <polyline
            points={points}
            className="stroke-dot-info"
            strokeWidth={unit * SIZE.stroke}
            strokeDasharray={`${unit * SIZE.dash} ${unit * SIZE.gap}`}
            {...line}
          />
        </>
      )}
      {path.start && (
        <rect
          role="img"
          aria-label={R.start(path.start.locationCode)}
          x={path.start.x - mark * 1.1}
          y={path.start.y - mark * 1.1}
          width={mark * 2.2}
          height={mark * 2.2}
          rx={0.15}
          className="fill-ink-primary stroke-bg-surface"
          strokeWidth={mark * 0.25}
        />
      )}
      {origin && (
        <circle
          role="img"
          aria-label={R.origin(origin.locationCode)}
          cx={origin.x}
          cy={origin.y}
          r={mark * 0.8}
          className="fill-bg-surface stroke-ink-primary"
          strokeWidth={mark * 0.35}
        />
      )}
      {stops.map((stop) => (
        <RouteStopMarker
          key={stop.sequence}
          stop={stop}
          bin={routeBinTarget(shelves, stop.locationCode)}
          mark={mark}
        />
      ))}
    </g>
  );
}
