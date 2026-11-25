import { describe, expect, it } from "vitest";

import { LAYOUT } from "./__fixtures__/layout";
import { routeBinTarget, routeLine, routeMarkerPoint, routeOrigin } from "./route-line";

import type { RouteMapPath, RouteMapStop } from "./route-line";

const stop = (sequence: number, x: number, y: number, path: RouteMapStop["path"] = null) => ({
  sequence,
  locationCode: `S${sequence}`,
  x,
  y,
  state: "todo" as const,
  path,
});

const START = { locationCode: "RCV01", x: 7, y: 6 };

describe("routeLine — vẽ đường BE trả cho từng chặng (docs 05 §4.5 bước 14, BE #410)", () => {
  it("nối các `path` của BE thành một đường, không lặp điểm nối giữa hai chặng", () => {
    const path: RouteMapPath = {
      start: START,
      origin: START,
      stops: [
        stop(1, 17.2, 6.5, [
          { x: 7, y: 6 },
          { x: 16.75, y: 3.75 },
          { x: 17.2, y: 6.5 },
        ]),
        stop(2, 24, 6.5, [
          { x: 17.2, y: 6.5 },
          { x: 23.75, y: 3.75 },
          { x: 24, y: 6.5 },
        ]),
      ],
    };
    expect(routeLine(path)).toEqual([
      { x: 7, y: 6 },
      { x: 16.75, y: 3.75 },
      { x: 17.2, y: 6.5 },
      { x: 23.75, y: 3.75 },
      { x: 24, y: 6.5 },
    ]);
  });

  it("chặng BE không có đường (null) → đoạn thẳng từ điểm trước, các chặng khác vẫn theo BE", () => {
    const path: RouteMapPath = {
      start: START,
      origin: START,
      stops: [
        stop(1, 17.2, 6.5, null),
        stop(2, 24, 6.5, [
          { x: 17.2, y: 6.5 },
          { x: 23.75, y: 3.75 },
          { x: 24, y: 6.5 },
        ]),
      ],
    };
    expect(routeLine(path)).toEqual([
      { x: 7, y: 6 },
      { x: 17.2, y: 6.5 },
      { x: 23.75, y: 3.75 },
      { x: 24, y: 6.5 },
    ]);
  });

  it("đã cất vài thùng: chặng 1 đi từ điểm gốc BE dùng để sắp (bin vừa cất), không nối từ khu nguồn", () => {
    const origin = { locationCode: "A01-1-01", x: 16, y: 5 };
    const path: RouteMapPath = {
      start: START,
      origin,
      stops: [stop(1, 24, 6.5, null)],
    };
    expect(routeLine(path)).toEqual([
      { x: 16, y: 5 },
      { x: 24, y: 6.5 },
    ]);
  });

  it("BE cũ (không có điểm gốc, không có path) → nối thẳng từ khu nguồn như trước", () => {
    const path: RouteMapPath = { start: START, stops: [stop(1, 17.2, 6.5), stop(2, 24, 6.5)] };
    expect(routeLine(path)).toEqual([
      { x: 7, y: 6 },
      { x: 17.2, y: 6.5 },
      { x: 24, y: 6.5 },
    ]);
  });

  it("hai điểm dừng cùng điểm đứng (path BE `[p, p]`) không thêm điểm thừa; không có gì để nối → rỗng", () => {
    const same: RouteMapPath = {
      start: null,
      stops: [
        stop(1, 4, 6),
        stop(2, 4, 6, [
          { x: 4, y: 6 },
          { x: 4, y: 6 },
        ]),
      ],
    };
    expect(routeLine(same)).toEqual([{ x: 4, y: 6 }]);
    expect(routeLine({ start: null, stops: [] })).toEqual([]);
  });
});

describe("routeOrigin — điểm gốc chỉ cần đánh dấu riêng khi khác khu nguồn", () => {
  it("trùng khu nguồn hoặc không có → null; khác (đã cất thùng) → điểm gốc", () => {
    expect(routeOrigin({ start: START, origin: START, stops: [] })).toBeNull();
    expect(routeOrigin({ start: START, stops: [] })).toBeNull();
    const origin = { locationCode: "A01-1-01", x: 16, y: 5 };
    expect(routeOrigin({ start: START, origin, stops: [] })).toEqual(origin);
    expect(routeOrigin({ start: null, origin, stops: [] })).toEqual(origin);
  });

  it("bin vừa cất vẫn còn thùng trên xe (trùng một điểm dừng) → null, chấm điểm dừng đã che chỗ đó", () => {
    const origin = { locationCode: "A01-1-01", x: 16, y: 5 };
    expect(
      routeOrigin({ start: START, origin, stops: [stop(1, 16, 5), stop(2, 24, 6.5)] }),
    ).toBeNull();
  });
});

describe("routeBinTarget — ô bin cần đặt, tô trên kệ (docs 05 §4.5 bước 14)", () => {
  const A01 = LAYOUT.shelves[0];

  it("tìm bin theo mã ở mọi tầng, trả khung trong kệ + phép xoay của kệ", () => {
    expect(routeBinTarget(LAYOUT.shelves, "HCM-A01-1-B")).toEqual({
      transform: "translate(5 5) rotate(0)",
      center: { x: 12.5, y: 5.6 },
      x: 5,
      y: 0,
      width: 5,
      height: 1.2,
    });
    // Tầng 2 cùng cột với tầng 1 → cùng ô trên mặt bằng
    expect(routeBinTarget(LAYOUT.shelves, "HCM-A01-2-A")).toMatchObject({ x: 0, y: 0 });
  });

  it("kệ xoay 90° dùng đúng phép xoay của kệ như ShelfShape", () => {
    const turned = A01 && { ...A01, footprint: { ...A01.footprint, rotation: 90 } };
    expect(turned && routeBinTarget([turned], "HCM-A01-1-A")?.transform).toBe(
      "translate(6.2 5) rotate(90)",
    );
  });

  it("mã không phải bin trên mặt bằng (khu tràn, chưa tải layout) → null, chỉ vẽ chấm", () => {
    expect(routeBinTarget(LAYOUT.shelves, "HCM-OVF01")).toBeNull();
    expect(routeBinTarget([], "HCM-A01-1-A")).toBeNull();
  });
});

describe("routeMarkerPoint — chấm số nằm ở lối đi, sát mép kệ, không đè lên kệ", () => {
  it("đẩy chấm từ điểm đứng ra xa tâm ô bin đúng một bán kính", () => {
    const bin = routeBinTarget(LAYOUT.shelves, "HCM-A01-1-A");
    // Ô A01-1-A: x 5–10, y 5–6,2 → tâm (7,5; 5,6); điểm đứng ở mặt nam (7,5; 6,2)
    expect(bin?.center).toEqual({ x: 7.5, y: 5.6 });
    expect(routeMarkerPoint({ x: 7.5, y: 6.2 }, bin?.center ?? null, 0.5)).toEqual({
      x: 7.5,
      y: 6.7,
    });
  });

  it("kệ xoay 90°: tâm ô tính theo phép xoay của kệ", () => {
    const A01 = LAYOUT.shelves[0];
    const turned = A01 && { ...A01, footprint: { ...A01.footprint, rotation: 90 } };
    // Xoay 90° quanh (6,2; 5): ô (0–5, 0–1,2) → x 5–6,2, y 5–10 → tâm (5,6; 7,5)
    expect(turned && routeBinTarget([turned], "HCM-A01-1-A")?.center).toEqual({ x: 5.6, y: 7.5 });
  });

  it("không có ô bin (khu) hoặc điểm đứng trùng tâm → giữ nguyên điểm đứng", () => {
    expect(routeMarkerPoint({ x: 3, y: 4 }, null, 0.5)).toEqual({ x: 3, y: 4 });
    expect(routeMarkerPoint({ x: 3, y: 4 }, { x: 3, y: 4 }, 0.5)).toEqual({ x: 3, y: 4 });
  });
});
