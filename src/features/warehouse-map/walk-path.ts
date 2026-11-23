/**
 * Đường đi vòng qua kệ / tường cho lộ trình chuyến cất (docs 05 §4.5 bước 14, ⚠️ C46) — thuần, không side effect.
 * A* 8 hướng trên `WalkGrid` để tìm topo, rồi kéo thẳng (string pulling) bằng kiểm tra hình học chính xác. Điểm đứng
 * BE trả giữ nguyên làm đầu mút; chặng không tìm được lối (vd cửa đóng) thì vẽ đoạn thẳng như cũ.
 */

import { WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { canMove, cellCenter, clearLine, DIRECTIONS } from "./walk-grid";

import type { MapPoint } from "./draft-geometry";
import type { WalkGrid } from "./walk-grid";

const SQRT2 = Math.SQRT2;

/** Hàng đợi ưu tiên nhỏ nhất (binary heap) theo `f`. */
class MinHeap {
  private items: { id: number; f: number }[] = [];
  get size() {
    return this.items.length;
  }
  push(id: number, f: number) {
    const items = this.items;
    items.push({ id, f });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].f <= items[i].f) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop(): number {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0 && last) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && items[l].f < items[m].f) m = l;
        if (r < items.length && items[r].f < items[m].f) m = r;
        if (m === i) break;
        [items[m], items[i]] = [items[i], items[m]];
        i = m;
      }
    }
    return top.id;
  }
}

const inside = (grid: WalkGrid, p: MapPoint) =>
  p.x >= 0 && p.y >= 0 && p.x <= grid.width && p.y <= grid.height;

/** Ô trống gần `p` nhất mà từ `p` đi thẳng tới tâm ô được (điểm đứng nằm sát mặt kệ / giữa khu). */
export function nearestFreeCell(grid: WalkGrid, p: MapPoint): number | null {
  const radius = Math.ceil(LIMITS.routeSnapRadius / grid.step);
  const c0 = Math.min(grid.cols - 1, Math.floor(p.x / grid.step));
  const r0 = Math.min(grid.rows - 1, Math.floor(p.y / grid.step));
  const candidates: { id: number; d: number }[] = [];
  for (let r = Math.max(0, r0 - radius); r <= Math.min(grid.rows - 1, r0 + radius); r++)
    for (let c = Math.max(0, c0 - radius); c <= Math.min(grid.cols - 1, c0 + radius); c++) {
      if (grid.blocked[r * grid.cols + c]) continue;
      const center = cellCenter(grid, c, r);
      candidates.push({ id: r * grid.cols + c, d: Math.hypot(center.x - p.x, center.y - p.y) });
    }
  candidates.sort((a, b) => a.d - b.d);
  const hit = candidates.find(({ id }) =>
    clearLine(grid, p, cellCenter(grid, id % grid.cols, Math.floor(id / grid.cols))),
  );
  return hit ? hit.id : null;
}

/** A* 8 hướng giữa hai ô; `null` khi không có lối. */
export function findCellPath(grid: WalkGrid, from: number, to: number): number[] | null {
  const { cols } = grid;
  const goal = { c: to % cols, r: Math.floor(to / cols) };
  const h = (id: number) => {
    const dc = Math.abs((id % cols) - goal.c);
    const dr = Math.abs(Math.floor(id / cols) - goal.r);
    return Math.max(dc, dr) + (SQRT2 - 1) * Math.min(dc, dr);
  };
  const cost = new Float64Array(grid.cols * grid.rows).fill(Infinity);
  const came = new Int32Array(grid.cols * grid.rows).fill(-1);
  const closed = new Uint8Array(grid.cols * grid.rows);
  const open = new MinHeap();
  cost[from] = 0;
  open.push(from, h(from));
  while (open.size > 0) {
    const id = open.pop();
    if (id === to) {
      const path = [id];
      for (let at = id; came[at] !== -1;) path.push((at = came[at]));
      return path.reverse();
    }
    if (closed[id]) continue;
    closed[id] = 1;
    const c = id % cols;
    const r = Math.floor(id / cols);
    for (const [dc, dr] of DIRECTIONS) {
      const next = (r + dr) * cols + (c + dc);
      if (!canMove(grid, c, r, dc, dr) || closed[next]) continue;
      const g = cost[id] + (dc !== 0 && dr !== 0 ? SQRT2 : 1);
      if (g >= cost[next]) continue;
      cost[next] = g;
      came[next] = id;
      open.push(next, g + h(next));
    }
  }
  return null;
}

/** Kéo thẳng: từ mỗi mốc nối tới điểm xa nhất còn nhìn thấy, bỏ các khúc gãy thừa của lưới. */
function pull(grid: WalkGrid, points: readonly MapPoint[]): MapPoint[] {
  const out = [points[0]];
  let anchor = 0;
  while (anchor < points.length - 1) {
    let next = anchor + 1;
    for (let j = anchor + 2; j < points.length; j++) {
      if (!clearLine(grid, points[anchor], points[j])) break;
      next = j;
    }
    out.push(points[next]);
    anchor = next;
  }
  return out;
}

/** Một chặng `from` → `to` vòng qua vật cản; `null` khi không tìm được lối. */
export function walkLeg(grid: WalkGrid, from: MapPoint, to: MapPoint): MapPoint[] | null {
  if (!inside(grid, from) || !inside(grid, to)) return null;
  if (clearLine(grid, from, to)) return [from, to];
  const start = nearestFreeCell(grid, from);
  const goal = nearestFreeCell(grid, to);
  if (start === null || goal === null) return null;
  const cells = findCellPath(grid, start, goal);
  if (!cells) return null;
  const centers = cells.map((id) => cellCenter(grid, id % grid.cols, Math.floor(id / grid.cols)));
  return pull(grid, [from, ...centers, to]);
}

/**
 * Cả lộ trình: nối từng chặng theo thứ tự điểm đã cho (thứ tự BE sắp — BR-17), chặng không có lối thì đoạn thẳng.
 * Điểm trùng liền nhau (hai bin cùng điểm đứng) không tạo chặng rỗng.
 */
export function walkRoute(grid: WalkGrid, points: readonly MapPoint[]): MapPoint[] {
  const stops = points.filter(
    (p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y,
  );
  if (stops.length < 2) return [...stops];
  const out: MapPoint[] = [stops[0]];
  for (let i = 1; i < stops.length; i++) {
    const leg = walkLeg(grid, stops[i - 1], stops[i]) ?? [stops[i - 1], stops[i]];
    out.push(...leg.slice(1));
  }
  return out;
}
