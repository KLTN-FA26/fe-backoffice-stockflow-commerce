/**
 * Đường lộ trình chuyến cất vẽ trên Kho Map 2D (docs 05 §4.5 bước 14) — thuần, không side effect. BE sắp thứ tự điểm
 * dừng (BR-17) và tính đường đi vòng kệ / tường / cửa đóng cho từng chặng (BE #410); ở đây chỉ nối các chặng lại.
 * Chặng BE không trả đường (không có lối, hoặc BE chưa có trường) → đoạn thẳng như trước (⚠️ C46).
 */

import type { MapPoint } from "./draft-geometry";

export type RouteStopState = "done" | "next" | "todo";

export interface RouteMapPoint {
  locationCode: string | null;
  x: number;
  y: number;
}

export interface RouteMapStop {
  sequence: number;
  locationCode: string;
  x: number;
  y: number;
  state: RouteStopState;
  /** Đường đi BE tính tới điểm này, gồm cả hai đầu; vắng / null → nối thẳng từ điểm trước. */
  path?: readonly MapPoint[] | null;
}

/** Dữ liệu lộ trình nhận qua props — feature cất hàng dựng từ response chuyến cất. */
export interface RouteMapPath {
  /** Tâm khu nguồn — ô "Xuất phát". */
  start: RouteMapPoint | null;
  /** Nơi BE sắp các điểm dừng còn lại (bin vừa cất, chưa cất thì khu nguồn); vắng → coi như `start`. */
  origin?: RouteMapPoint | null;
  stops: readonly RouteMapStop[];
}

const same = (a: MapPoint, b: MapPoint) => a.x === b.x && a.y === b.y;

/**
 * Điểm gốc cần chấm riêng: chỉ khi khác ô "Xuất phát" (đã cất thùng ở bin khác khu nguồn) và không trùng điểm dừng nào
 * — bin vừa cất còn thùng trên xe thì BE vẫn giữ nó làm điểm dừng, chấm điểm dừng sẽ che mất chấm "Vừa cất".
 */
export function routeOrigin(path: RouteMapPath): RouteMapPoint | null {
  const { origin, start } = path;
  if (!origin) return null;
  if (start && same(origin, start)) return null;
  return path.stops.some((stop) => same(origin, stop)) ? null : origin;
}

/** Các điểm của đường vẽ: điểm gốc → chặng 1 → chặng 2…, điểm nối giữa hai chặng không lặp lại. */
export function routeLine(path: RouteMapPath): MapPoint[] {
  const out: MapPoint[] = [];
  const push = (p: MapPoint) => {
    const last = out[out.length - 1];
    if (!last || !same(last, p)) out.push({ x: p.x, y: p.y });
  };
  const from = path.origin ?? path.start;
  if (from) push(from);
  for (const stop of path.stops) {
    const leg = stop.path && stop.path.length >= 2 ? stop.path : [stop];
    leg.forEach(push);
  }
  return out;
}
