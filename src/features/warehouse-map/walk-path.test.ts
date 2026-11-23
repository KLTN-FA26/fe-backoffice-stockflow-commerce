import { describe, expect, it } from "vitest";

import { boxOf } from "./selectors";
import { buildWalkGrid, crossesBox, crossesWall } from "./walk-grid";
import { walkLeg, walkRoute } from "./walk-path";

import type { MapPoint } from "./draft-geometry";
import type { Boundary, LayoutArea, LayoutShelf, WarehouseLayout } from "./types";

type Layout = Pick<WarehouseLayout, "warehouse" | "shelves" | "areas" | "boundaries">;

const shelf = (code: string, x: number, y: number, width: number, length: number): LayoutShelf => ({
  id: `shelf-${code}`,
  code,
  name: code,
  footprint: { x, y, width, length, rotation: 0 },
  obstacle: true,
  pickFaces: { north: false, east: true, south: false, west: true },
  status: "ACTIVE",
  effectiveStatus: "ACTIVE",
  version: 0,
  levels: [],
});

const area = (code: string, x: number, y: number, obstacle: boolean): LayoutArea => ({
  id: `area-${code}`,
  code,
  type: "NON_STORAGE",
  name: code,
  footprint: { x, y, width: 4, length: 4, rotation: 0 },
  obstacle,
  status: "ACTIVE",
  effectiveStatus: "ACTIVE",
  version: 0,
});

const line = (
  type: Boundary["type"],
  [startX, startY, endX, endY]: [number, number, number, number],
  open = false,
): Boundary => ({
  id: `${type}-${startX}-${startY}-${endX}-${endY}`,
  type,
  startX,
  startY,
  endX,
  endY,
  passable: type === "DOOR" && open,
  operationalStatus: type === "DOOR" ? (open ? "OPEN" : "CLOSED") : null,
  version: 0,
});

const layout = (parts: Partial<Layout>): Layout => ({
  warehouse: {
    id: "wh",
    prefix: "T",
    name: "Kho test",
    mapUnit: "M",
    mapWidth: 30,
    mapHeight: 20,
    status: "ACTIVE",
    version: 0,
  },
  shelves: [],
  areas: [],
  boundaries: [],
  ...parts,
});

const segments = (path: readonly MapPoint[]) => path.slice(1).map((b, i) => ({ a: path[i], b }));

/** Không đoạn nào của đường vẽ đi vào trong kệ / khu chướng ngại hay chạm tường — trừ hộp chứa hẳn đầu mút. */
function expectClear(path: readonly MapPoint[], parts: Layout) {
  const boxes = [...parts.shelves, ...parts.areas]
    .filter((i) => i.obstacle)
    .map((i) => boxOf(i.footprint));
  const walls = parts.boundaries
    .filter((b) => b.type === "WALL" || !b.passable)
    .map((b) => ({ a: { x: b.startX, y: b.startY }, b: { x: b.endX, y: b.endY } }));
  const first = path[0];
  const last = path[path.length - 1];
  const holds = (box: (typeof boxes)[number], p: MapPoint) =>
    p.x > box.x && p.x < box.x + box.w && p.y > box.y && p.y < box.y + box.h;
  for (const { a, b } of segments(path)) {
    for (const box of boxes)
      if (!holds(box, first) && !holds(box, last)) expect(crossesBox(a, b, box)).toBe(false);
    for (const wall of walls) expect(crossesWall(a, b, wall)).toBe(false);
  }
}

describe("walkLeg — đường vòng qua vật cản (docs 05 §4.5 bước 14, ⚠️ C46)", () => {
  const blocking = layout({ shelves: [shelf("A01", 10, 2, 2, 14)] });

  it("đường thẳng xuyên kệ → vòng qua đầu kệ, đầu mút giữ nguyên điểm đứng", () => {
    const from = { x: 5, y: 9 };
    const to = { x: 17, y: 9 };
    const path = walkLeg(buildWalkGrid(blocking), from, to);
    expect(path).not.toBeNull();
    expect(path?.[0]).toEqual(from);
    expect(path?.at(-1)).toEqual(to);
    expect(path?.length).toBeGreaterThan(2);
    expectClear(path ?? [], blocking);
  });

  it("nhìn thấy nhau → một đoạn thẳng, không bẻ theo lưới", () => {
    const path = walkLeg(buildWalkGrid(blocking), { x: 2, y: 3 }, { x: 7, y: 18 });
    expect(path).toEqual([
      { x: 2, y: 3 },
      { x: 7, y: 18 },
    ]);
  });

  it("điểm đứng nằm đúng trên mặt lấy hàng (mép kệ) vẫn đi được, không coi là kẹt trong kệ", () => {
    // Mặt tây kệ A01 (x = 10) → mặt đông (x = 12)
    const path = walkLeg(buildWalkGrid(blocking), { x: 10, y: 9 }, { x: 12, y: 9 });
    expect(path).not.toBeNull();
    expectClear(path ?? [], blocking);
  });

  it("lối đi hẹp lệch lưới (0,7 m giữa hai kệ) vẫn mở — không bị lưới 0,5 m bịt", () => {
    const narrow = layout({
      shelves: [shelf("A01", 0, 8, 14.8, 1.2), shelf("A02", 15.5, 8, 14.5, 1.2)],
    });
    const path = walkLeg(buildWalkGrid(narrow), { x: 15.15, y: 2 }, { x: 15.15, y: 18 });
    expect(path).not.toBeNull();
    // Đi xuyên khe chứ không vòng ra ngoài mép bản đồ (cả hai kệ chạm hai mép trái / phải)
    expect(Math.max(...(path ?? []).map((p) => Math.abs(p.x - 15.15)))).toBeLessThan(0.5);
    expectClear(path ?? [], narrow);
  });

  it("tường ngăn đôi kho có cửa đang mở → đi qua cửa", () => {
    const parts = layout({
      boundaries: [line("WALL", [15, 0, 15, 20]), line("DOOR", [15, 16, 15, 18], true)],
    });
    const path = walkLeg(buildWalkGrid(parts), { x: 5, y: 3 }, { x: 25, y: 3 });
    expect(path).not.toBeNull();
    const crossing = segments(path ?? []).find(({ a, b }) => (a.x - 15) * (b.x - 15) <= 0);
    const yAt = crossing
      ? crossing.a.y +
        ((15 - crossing.a.x) * (crossing.b.y - crossing.a.y)) / (crossing.b.x - crossing.a.x)
      : NaN;
    expect(yAt).toBeGreaterThanOrEqual(16);
    expect(yAt).toBeLessThanOrEqual(18);
    // Phần tường hai bên cửa vẫn không được chạm
    expectClear(
      path ?? [],
      layout({ boundaries: [line("WALL", [15, 0, 15, 16]), line("WALL", [15, 18, 15, 20])] }),
    );
  });

  it("cửa đóng nằm ở khe tường → không có lối, trả null (lộ trình sẽ vẽ thẳng)", () => {
    const wallWithGap = [line("WALL", [15, 0, 15, 16]), line("WALL", [15, 18, 15, 20])];
    const closed = layout({ boundaries: [...wallWithGap, line("DOOR", [15, 16, 15, 18], false)] });
    expect(walkLeg(buildWalkGrid(closed), { x: 5, y: 3 }, { x: 25, y: 3 })).toBeNull();
    // Cùng khe đó, cửa mở → có lối
    const open = layout({ boundaries: [...wallWithGap, line("DOOR", [15, 16, 15, 18], true)] });
    expect(walkLeg(buildWalkGrid(open), { x: 5, y: 3 }, { x: 25, y: 3 })).not.toBeNull();
  });

  it("khu chướng ngại là điểm dừng (điểm đứng = tâm khu) → được đi vào chính khu đó", () => {
    const parts = layout({ areas: [area("OVF", 20, 8, true)] });
    const to = { x: 22, y: 10 };
    const path = walkLeg(buildWalkGrid(parts), { x: 3, y: 3 }, to);
    expect(path?.at(-1)).toEqual(to);
  });

  it("kệ không phải chướng ngại (`obstacle: false`) → đi thẳng qua", () => {
    const flat = layout({ shelves: [{ ...shelf("A01", 10, 2, 2, 14), obstacle: false }] });
    expect(walkLeg(buildWalkGrid(flat), { x: 5, y: 9 }, { x: 17, y: 9 })).toHaveLength(2);
  });
});

describe("walkRoute — nối các chặng theo đúng thứ tự BE sắp (BR-17)", () => {
  it("chặng không có lối vẽ thẳng, chặng khác vẫn vòng; điểm trùng không tạo chặng rỗng", () => {
    const parts = layout({
      shelves: [shelf("A01", 4, 2, 2, 14)],
      boundaries: [line("WALL", [15, 0, 15, 20])],
    });
    const points = [
      { x: 1, y: 9 },
      { x: 9, y: 9 },
      { x: 9, y: 9 },
      { x: 25, y: 9 },
    ];
    const path = walkRoute(buildWalkGrid(parts), points);
    expect(path[0]).toEqual(points[0]);
    expect(path.at(-1)).toEqual(points[3]);
    // Chặng 1 vòng qua kệ → có điểm gãy; chặng cuối bị tường kín chặn → đúng một đoạn thẳng
    expect(path.length).toBeGreaterThan(3);
    expect(path.at(-2)).toEqual(points[1]);
    expectClear(path.slice(0, -1), { ...parts, boundaries: [] });
  });
});
