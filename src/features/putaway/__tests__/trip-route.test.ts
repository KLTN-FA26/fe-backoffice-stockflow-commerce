import { describe, expect, it } from "vitest";

import { tripRoutePath } from "../trip-selectors";
import { trip, tripCarton } from "./trip-fixtures";

const going = (overrides: Parameters<typeof trip>[0] = {}) =>
  trip({ status: "IN_PROGRESS", startLocationCode: "RCV01", startX: 2, startY: 18, ...overrides });

describe("tripRoutePath — đường nối điểm dừng trên Kho Map 2D (docs 05 §4.5 bước 14, BR-17)", () => {
  it("xuất phát từ tâm khu nguồn rồi đi theo thứ tự điểm dừng, không theo thứ tự mảng BE trả", () => {
    const path = tripRoutePath(
      going({
        cartons: [tripCarton({ lpn: "L1" }), tripCarton({ lpn: "L2", putawayTaskId: "t-2" })],
        stops: [
          { sequence: 2, locationCode: "B02-1-05", x: 9, y: 6, lpns: ["L2"] },
          { sequence: 1, locationCode: "A01-1-02", x: 4, y: 6, lpns: ["L1"] },
        ],
      }),
    );
    expect(path.start).toEqual({ locationCode: "RCV01", x: 2, y: 18 });
    expect(path.stops.map((s) => s.locationCode)).toEqual(["A01-1-02", "B02-1-05"]);
    expect(path.stops.map((s) => [s.x, s.y])).toEqual([
      [4, 6],
      [9, 6],
    ]);
  });

  it("điểm đã cất hết thùng là `done`, điểm đầu còn thùng trên xe là `next`, còn lại `todo` — không bắt buộc đi đúng thứ tự", () => {
    const path = tripRoutePath(
      going({
        cartons: [
          tripCarton({ lpn: "L1", status: "ON_CART" }),
          tripCarton({ lpn: "L2", putawayTaskId: "t-2", status: "PLACED" }),
          tripCarton({ lpn: "L3", putawayTaskId: "t-3", status: "ON_CART" }),
        ],
        stops: [
          { sequence: 1, locationCode: "A", x: 1, y: 1, lpns: ["L1"] },
          { sequence: 2, locationCode: "B", x: 2, y: 2, lpns: ["L2"] },
          { sequence: 3, locationCode: "C", x: 3, y: 3, lpns: ["L3"] },
        ],
      }),
    );
    expect(path.stops.map((s) => s.state)).toEqual(["next", "done", "todo"]);
  });

  it("điểm dừng hoặc khu nguồn không có toạ độ thì không vẽ — vẫn giữ số thứ tự gốc cho khớp danh sách", () => {
    const path = tripRoutePath(
      going({
        startX: null,
        startY: null,
        cartons: [tripCarton({ lpn: "L1" }), tripCarton({ lpn: "L2", putawayTaskId: "t-2" })],
        stops: [
          { sequence: 1, locationCode: "A", x: null, y: null, lpns: ["L1"] },
          { sequence: 2, locationCode: "OVERFLOW-01", x: 20, y: 3, lpns: ["L2"] },
        ],
      }),
    );
    expect(path.start).toBeNull();
    expect(path.stops).toEqual([
      { sequence: 2, locationCode: "OVERFLOW-01", x: 20, y: 3, state: "todo", path: null },
    ]);
  });

  it("đường đi BE tính (issue BE #410) đi kèm từng điểm dừng; điểm gốc BE dùng để sắp thứ tự cũng được đưa ra", () => {
    const walk = [
      { x: 7, y: 6 },
      { x: 16.75, y: 3.75 },
      { x: 17.2, y: 6.5 },
    ];
    const path = tripRoutePath(
      going({
        originLocationCode: "A01-1-01",
        originX: 7,
        originY: 6,
        cartons: [tripCarton({ lpn: "L1" }), tripCarton({ lpn: "L2", putawayTaskId: "t-2" })],
        stops: [
          { sequence: 1, locationCode: "A01-1-02", x: 17.2, y: 6.5, lpns: ["L1"], path: walk },
          // BE không tìm được lối → path null, FE vẽ đoạn thẳng
          { sequence: 2, locationCode: "B02-1-05", x: 30, y: 6.5, lpns: ["L2"], path: null },
        ],
      }),
    );
    expect(path.origin).toEqual({ locationCode: "A01-1-01", x: 7, y: 6 });
    expect(path.stops.map((s) => s.path)).toEqual([walk, null]);
  });

  it("BE cũ chưa trả điểm gốc / đường đi → origin null, path null (vẽ thẳng như trước)", () => {
    const path = tripRoutePath(
      going({
        cartons: [tripCarton({ lpn: "L1" })],
        stops: [{ sequence: 1, locationCode: "A", x: 4, y: 6, lpns: ["L1"] }],
      }),
    );
    expect(path.origin).toBeNull();
    expect(path.stops[0]?.path).toBeNull();
  });

  it("chuyến chưa đi (không có điểm dừng) → không có gì để vẽ", () => {
    expect(tripRoutePath(trip()).stops).toEqual([]);
  });
});
