import { describe, expect, it } from "vitest";

import { beTripSchema } from "../trip-schemas";

const response = {
  id: "trip-1",
  warehouseId: "wh-1",
  operatorId: "u-1",
  status: "IN_PROGRESS",
  startLocationCode: "BDG-RCV01",
  startX: 53,
  startY: 5.5,
  lastActivityAt: "2026-11-25T02:00:00Z",
  cartons: [],
};

describe("beTripSchema — đường đi từng chặng của BE (#410, docs 05 §4.5 bước 14)", () => {
  it("đọc điểm gốc + `stops[].path`; `path` null khi BE không tìm được lối", () => {
    const trip = beTripSchema.parse({
      ...response,
      originLocationCode: "BDG-RCV01",
      originX: 53,
      originY: 5.5,
      stops: [
        {
          sequence: 1,
          locationCode: "BDG-A02-3-B",
          x: 20.7,
          y: 4,
          lpns: ["LPN-1"],
          path: [
            { x: 53, y: 5.5 },
            { x: 38.25, y: 3.75 },
            { x: 20.7, y: 4 },
          ],
        },
        { sequence: 2, locationCode: "BDG-OVF01", x: 50, y: 33, lpns: ["LPN-2"], path: null },
      ],
    });
    expect(trip.originLocationCode).toBe("BDG-RCV01");
    expect(trip.stops[0]?.path).toHaveLength(3);
    expect(trip.stops[1]?.path).toBeNull();
  });

  it("BE chưa có #410 (không có điểm gốc, không có `path` — NON_NULL bỏ trường null) vẫn đọc được", () => {
    const trip = beTripSchema.parse({
      ...response,
      stops: [{ sequence: 1, locationCode: "BDG-A02-3-B", x: 20.7, y: 4, lpns: ["LPN-1"] }],
    });
    expect(trip.originX).toBeUndefined();
    expect(trip.stops[0]?.path).toBeUndefined();
  });

  it("điểm của đường đi thiếu toạ độ → lỗi hợp đồng, không vẽ bừa", () => {
    expect(() =>
      beTripSchema.parse({
        ...response,
        stops: [{ sequence: 1, locationCode: "A", x: 1, y: 1, lpns: [], path: [{ x: 1 }] }],
      }),
    ).toThrow();
  });
});
