import { describe, expect, it } from "vitest";

import { routeLine, routeOrigin } from "./route-line";

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
});
