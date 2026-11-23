/**
 * Mặt bằng đi được để vẽ lộ trình chuyến cất (docs 05 §4.5 bước 14) — thuần, không side effect.
 *
 * ⚠️ C46: kho chưa khai báo lối đi; BE sắp điểm dừng theo khoảng cách Manhattan và chỉ trả điểm đứng. Ở đây FE ước
 * lượng chỗ đi được từ chính bản đồ: kệ / khu vực có cờ chướng ngại (`obstacle`) là vật cản, tường và cửa đóng
 * chặn đường, cửa đang mở (`passable` + `OPEN`) là lối qua tường. Chỉ để vẽ — không đổi thứ tự điểm dừng (BR-17).
 *
 * Lưới ô vuông chỉ dùng cho topo: ô trống khi tâm ô nằm ngoài mọi vật cản (không chặn ô vì chạm mép — lối hẹp lệch
 * lưới vẫn mở); bước đi giữa hai tâm ô kiểm bằng hình học chính xác (đoạn thẳng × hộp / tường).
 */

import { BOUNDARY_TYPE, WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { boxOf } from "./selectors";

import type { MapPoint } from "./draft-geometry";
import type { MapBox } from "./selectors";
import type { Boundary, WarehouseLayout } from "./types";

const EPS = 1e-9;

export interface WalkSegment {
  a: MapPoint;
  b: MapPoint;
}

export interface WalkGrid {
  width: number;
  height: number;
  step: number;
  cols: number;
  rows: number;
  /** Vật cản dạng hộp (kệ / khu vực `obstacle`). */
  boxes: readonly MapBox[];
  /** Tường (đã khoét chỗ cửa mở) + cửa đóng. */
  walls: readonly WalkSegment[];
  /** 1 = tâm ô nằm trong vật cản. */
  blocked: Uint8Array;
}

/** 8 hướng đi giữa các ô — cạnh trước, chéo sau. */
export const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const strictlyInside = (p: MapPoint, box: MapBox) =>
  p.x > box.x + EPS && p.x < box.x + box.w - EPS && p.y > box.y + EPS && p.y < box.y + box.h - EPS;

/** Đoạn thẳng đi vào PHẦN TRONG của hộp (Liang–Barsky) — chạm hoặc trượt theo mép thì không tính. */
export function crossesBox(a: MapPoint, b: MapPoint, box: MapBox): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < EPS) return q > EPS;
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    return t0 < t1;
  };
  const ok =
    clip(-dx, a.x - box.x) &&
    clip(dx, box.x + box.w - a.x) &&
    clip(-dy, a.y - box.y) &&
    clip(dy, box.y + box.h - a.y);
  if (!ok) return false;
  // Đoạn cắt trong hộp phải có trung điểm nằm hẳn bên trong (loại trường hợp chỉ lướt theo mép)
  const tm = (t0 + t1) / 2;
  return strictlyInside({ x: a.x + dx * tm, y: a.y + dy * tm }, box);
}

const cross = (o: MapPoint, p: MapPoint, q: MapPoint) =>
  (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
const within = (v: number, a: number, b: number) =>
  v >= Math.min(a, b) - EPS && v <= Math.max(a, b) + EPS;
const onSegment = (p: MapPoint, s: WalkSegment) =>
  Math.abs(cross(s.a, s.b, p)) < EPS && within(p.x, s.a.x, s.b.x) && within(p.y, s.a.y, s.b.y);

/** Hai đoạn có điểm chung (kể cả chạm đầu mút / trùng phương) — đi chạm tường cũng là chặn. */
export function crossesWall(a: MapPoint, b: MapPoint, wall: WalkSegment): boolean {
  const d1 = cross(wall.a, wall.b, a);
  const d2 = cross(wall.a, wall.b, b);
  const d3 = cross(a, b, wall.a);
  const d4 = cross(a, b, wall.b);
  if (
    ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) &&
    ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))
  )
    return true;
  const move = { a, b };
  return (
    onSegment(a, wall) || onSegment(b, wall) || onSegment(wall.a, move) || onSegment(wall.b, move)
  );
}

/** Đi thẳng từ `a` tới `b` không xuyên vật cản / tường. Hộp chứa hẳn một đầu mút được bỏ qua (điểm đứng là tâm khu). */
export function clearLine(
  grid: Pick<WalkGrid, "boxes" | "walls">,
  a: MapPoint,
  b: MapPoint,
): boolean {
  return (
    grid.walls.every((wall) => !crossesWall(a, b, wall)) &&
    grid.boxes.every(
      (box) => strictlyInside(a, box) || strictlyInside(b, box) || !crossesBox(a, b, box),
    )
  );
}

const lineOf = (b: Boundary): WalkSegment => ({
  a: { x: b.startX, y: b.startY },
  b: { x: b.endX, y: b.endY },
});

/** Bỏ khỏi tường phần trùng một cửa đang mở cùng phương — cửa vẽ đè lên tường là lối qua tường. */
function carveDoors(wall: WalkSegment, doors: readonly WalkSegment[]): WalkSegment[] {
  const dx = wall.b.x - wall.a.x;
  const dy = wall.b.y - wall.a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < EPS) return [wall];
  const at = (p: MapPoint) => ((p.x - wall.a.x) * dx + (p.y - wall.a.y) * dy) / len2;
  const cuts = doors
    .filter(
      (door) =>
        Math.abs(cross(wall.a, wall.b, door.a)) < EPS &&
        Math.abs(cross(wall.a, wall.b, door.b)) < EPS,
    )
    .map((door) => [Math.min(at(door.a), at(door.b)), Math.max(at(door.a), at(door.b))] as const)
    .sort((p, q) => p[0] - q[0]);
  const pieces: WalkSegment[] = [];
  const point = (t: number) => ({ x: wall.a.x + dx * t, y: wall.a.y + dy * t });
  let from = 0;
  for (const [s, e] of cuts) {
    if (s > from + EPS) pieces.push({ a: point(from), b: point(Math.min(s, 1)) });
    from = Math.max(from, e);
  }
  if (from < 1 - EPS) pieces.push({ a: point(from), b: point(1) });
  return pieces;
}

/** Ô (c, r) đi sang ô bên cạnh được không — tâm ô kia trống và đoạn nối không xuyên vật cản / tường. */
export function canMove(grid: WalkGrid, c: number, r: number, dc: number, dr: number): boolean {
  const nc = c + dc;
  const nr = r + dr;
  if (nc < 0 || nr < 0 || nc >= grid.cols || nr >= grid.rows) return false;
  if (grid.blocked[nr * grid.cols + nc]) return false;
  // Đi chéo không lách qua góc hai ô bị chặn
  if (
    dc !== 0 &&
    dr !== 0 &&
    (grid.blocked[r * grid.cols + nc] || grid.blocked[nr * grid.cols + c])
  )
    return false;
  return clearLine(grid, cellCenter(grid, c, r), cellCenter(grid, nc, nr));
}

export const cellCenter = (grid: Pick<WalkGrid, "step">, c: number, r: number): MapPoint => ({
  x: (c + 0.5) * grid.step,
  y: (r + 0.5) * grid.step,
});

export function buildWalkGrid(
  layout: Pick<WarehouseLayout, "warehouse" | "shelves" | "areas" | "boundaries">,
): WalkGrid {
  const { mapWidth: width, mapHeight: height } = layout.warehouse;
  const step = Math.max(
    LIMITS.routeGridStep,
    Math.sqrt((width * height) / LIMITS.routeGridMaxCells),
  );
  const cols = Math.max(1, Math.ceil(width / step));
  const rows = Math.max(1, Math.ceil(height / step));
  // Kệ / khu ngưng (INACTIVE) vẫn vẽ trên bản đồ và vẫn đứng đó → vẫn là vật cản
  const boxes = [...layout.shelves, ...layout.areas]
    .filter((item) => item.obstacle)
    .map((item) => boxOf(item.footprint));
  const openDoors = layout.boundaries
    .filter((b) => b.type === BOUNDARY_TYPE.DOOR && b.passable && b.operationalStatus === "OPEN")
    .map(lineOf);
  const walls = layout.boundaries.flatMap((b) => {
    if (b.type === BOUNDARY_TYPE.WALL) return carveDoors(lineOf(b), openDoors);
    return b.passable && b.operationalStatus === "OPEN" ? [] : [lineOf(b)];
  });
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const center = cellCenter({ step }, c, r);
      if (boxes.some((box) => strictlyInside(center, box))) blocked[r * cols + c] = 1;
    }
  return { width, height, step, cols, rows, boxes, walls, blocked };
}
