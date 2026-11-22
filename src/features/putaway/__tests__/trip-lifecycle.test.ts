import { describe, expect, it } from "vitest";

import { PUTAWAY_TRIP_PERMISSIONS as P, PUTAWAY_TRIP_STATUSES } from "@/constants";

import { PUTAWAY_TRIP_TRANSITIONS, isTripOpen, tripActions } from "../trip-lifecycle";
import { holdExpired, stopsWithCartons, tripProgress } from "../trip-selectors";
import { trip, tripCarton } from "./trip-fixtures";

import type { PermissionCode } from "@/lib/auth/me-permissions";

const can =
  (...codes: PermissionCode[]) =>
  (code: PermissionCode) =>
    codes.includes(code);
const STAFF = can(P.read, P.update);
const MANAGER = can(P.read, P.update, P.approve);
const VIEWER = can(P.read);

describe("PUTAWAY_TRIP_TRANSITIONS (docs 05 §5)", () => {
  it("đủ mọi trạng thái BE PutawayTripStatus", () => {
    expect(Object.keys(PUTAWAY_TRIP_TRANSITIONS).sort()).toEqual([...PUTAWAY_TRIP_STATUSES].sort());
  });

  it("Loading → In Progress / Closed; In Progress → Completed / Closed", () => {
    expect(PUTAWAY_TRIP_TRANSITIONS.LOADING).toEqual(["IN_PROGRESS", "CLOSED"]);
    expect(PUTAWAY_TRIP_TRANSITIONS.IN_PROGRESS).toEqual(["COMPLETED", "CLOSED"]);
  });

  it("Completed và Closed là terminal — không transition nào", () => {
    expect(PUTAWAY_TRIP_TRANSITIONS.COMPLETED).toEqual([]);
    expect(PUTAWAY_TRIP_TRANSITIONS.CLOSED).toEqual([]);
    expect(isTripOpen("CLOSED")).toBe(false);
    expect(isTripOpen("LOADING")).toBe(true);
  });
});

describe("tripActions — action-gating (chủ chuyến, quyền, trạng thái)", () => {
  it("nhân viên kho, chuyến của mình đang xếp hàng → xếp / đi / huỷ; xe rỗng thì khoá đi", () => {
    expect(tripActions(trip(), "u-test", STAFF)).toMatchObject({
      load: true,
      depart: true,
      departBlocked: true,
      place: false,
      close: true,
      forceClose: false,
    });
    expect(tripActions(trip({ cartons: [tripCarton()] }), "u-test", STAFF).departBlocked).toBe(
      false,
    );
  });

  it("chuyến của mình đang đi → đặt thùng + đóng, không xếp thêm", () => {
    expect(tripActions(trip({ status: "IN_PROGRESS" }), "u-test", STAFF)).toMatchObject({
      load: false,
      place: true,
      close: true,
    });
  });

  it("quản lý kho xem chuyến người khác → chỉ đóng hộ (APPROVE); nhân viên khác → không gì", () => {
    const theirs = trip({ operatorId: "someone" });
    expect(tripActions(theirs, "u-test", MANAGER)).toMatchObject({
      load: false,
      place: false,
      close: false,
      forceClose: true,
    });
    expect(Object.values(tripActions(theirs, "u-test", STAFF)).some(Boolean)).toBe(false);
  });

  it("chỉ có quyền xem → không thao tác, kể cả chuyến của mình", () => {
    expect(Object.values(tripActions(trip(), "u-test", VIEWER)).some(Boolean)).toBe(false);
  });

  it("chuyến đã kết thúc → không thao tác nào, kể cả quản lý", () => {
    for (const status of ["COMPLETED", "CLOSED"] as const) {
      expect(Object.values(tripActions(trip({ status }), "u-test", MANAGER)).some(Boolean)).toBe(
        false,
      );
    }
  });
});

describe("trip selectors", () => {
  it("tiến độ bỏ thùng đã trả về hàng chờ", () => {
    const t = trip({
      cartons: [
        tripCarton({ lpn: "A", status: "PLACED" }),
        tripCarton({ lpn: "B", status: "ON_CART" }),
        tripCarton({ lpn: "C", status: "RETURNED" }),
      ],
    });
    expect(tripProgress(t)).toEqual({ placed: 1, total: 2, onCart: 1 });
  });

  it("hết giữ chỗ = còn trên xe, có bin gán, holding false (BR-16)", () => {
    expect(holdExpired(tripCarton({ assignedLocationCode: "BIN", holding: false }))).toBe(true);
    expect(holdExpired(tripCarton({ assignedLocationCode: "BIN", holding: true }))).toBe(false);
    expect(holdExpired(tripCarton({ assignedLocationCode: null }))).toBe(false);
    expect(holdExpired(tripCarton({ assignedLocationCode: "BIN", status: "PLACED" }))).toBe(false);
  });

  it("điểm dừng theo thứ tự, kèm thùng theo LPN (không phân biệt hoa thường)", () => {
    const t = trip({
      cartons: [tripCarton({ lpn: "LPN-A" }), tripCarton({ lpn: "LPN-B" })],
      stops: [
        { sequence: 2, locationCode: "BIN-2", lpns: ["lpn-b"] },
        { sequence: 1, locationCode: "BIN-1", lpns: ["LPN-A", "LPN-GONE"] },
      ],
    });
    const stops = stopsWithCartons(t);
    expect(stops.map((s) => s.locationCode)).toEqual(["BIN-1", "BIN-2"]);
    expect(stops[0]?.cartons.map((c) => c.lpn)).toEqual(["LPN-A"]);
    expect(stops[1]?.cartons.map((c) => c.lpn)).toEqual(["LPN-B"]);
  });
});
