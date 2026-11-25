/**
 * Đường lộ trình chuyến cất vẽ trên Kho Map 2D (docs 05 §4.5 bước 14) — thuần, không side effect. BE sắp thứ tự điểm
 * dừng (BR-17) và tính đường đi vòng kệ / tường / cửa đóng cho từng chặng (BE #410); ở đây chỉ nối các chặng lại.
 * Chặng BE không trả đường (không có lối, hoặc BE chưa có trường) → đoạn thẳng như trước (⚠️ C46).
 */

import { shelfTransform } from "./selectors";

import type { MapPoint } from "./draft-geometry";
import type { LayoutShelf } from "./types";

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

/** Ô bin cần đặt, vẽ trong hệ toạ độ của kệ (`transform` giống `ShelfShape`) để tô đúng ô trên mặt bằng. */
export interface RouteBinTarget {
  transform: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Tâm ô trên mặt bằng (đã xoay theo kệ) — để đẩy chấm số ra phía lối đi. */
  center: MapPoint;
}

/** Điểm (u, v) trong kệ → mặt bằng, cùng phép `translate(tx ty) rotate(deg)` của `shelfTransform`. */
function toMap(u: number, v: number, { tx, ty, deg }: ReturnType<typeof shelfTransform>): MapPoint {
  if (deg === 90) return { x: tx - v, y: ty + u };
  if (deg === 180) return { x: tx - u, y: ty - v };
  if (deg === 270) return { x: tx + v, y: ty - u };
  return { x: tx + u, y: ty + v };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Tìm ô bin theo mã ở mọi tầng của kệ — bin tầng trên cùng cột với tầng dưới nên cùng ô trên mặt bằng. Không phải bin
 * (khu tràn / khu nguồn) hoặc chưa có mặt bằng → null, lộ trình chỉ vẽ chấm số.
 */
export function routeBinTarget(
  shelves: readonly Pick<LayoutShelf, "footprint" | "levels">[],
  locationCode: string,
): RouteBinTarget | null {
  for (const shelf of shelves) {
    for (const level of shelf.levels) {
      const bin = level.bins.find((b) => b.locationCode === locationCode);
      if (!bin) continue;
      const turn = shelfTransform(shelf.footprint);
      const { x, y, width, length } = bin.footprint;
      const mid = toMap(x + width / 2, y + length / 2, turn);
      return {
        transform: `translate(${turn.tx} ${turn.ty}) rotate(${turn.deg})`,
        x,
        y,
        width,
        height: length,
        center: { x: round(mid.x), y: round(mid.y) },
      };
    }
  }
  return null;
}

/**
 * Chỗ đặt chấm số: điểm đứng BE trả nằm ngay trên mặt lấy hàng, chấm tâm ở đó thì đè nửa lên kệ — đẩy ra xa tâm ô bin
 * đúng một bán kính để chấm nằm ở lối đi, sát mép kệ. Không có ô bin (khu) → giữ điểm đứng.
 */
export function routeMarkerPoint(
  stand: MapPoint,
  center: MapPoint | null,
  radius: number,
): MapPoint {
  if (!center) return { x: stand.x, y: stand.y };
  const dx = stand.x - center.x;
  const dy = stand.y - center.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: stand.x, y: stand.y };
  return { x: round(stand.x + (dx / len) * radius), y: round(stand.y + (dy / len) * radius) };
}

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
