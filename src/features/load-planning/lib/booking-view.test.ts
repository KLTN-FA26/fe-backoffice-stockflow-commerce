import { describe, expect, it } from "vitest";

import { bookingNeedsFetch, bookingSettled, bookingViewOf, warehouseLabelOf } from "./booking-view";

import type { PlanVehicle } from "../plan-types";
import type { LoadBooking } from "../print-booking";

const load = (status: string): PlanVehicle["load"] => ({ loadId: "l1", code: "LD-1", status });
const BOOKING: LoadBooking = { loadId: "l1", code: "LD-1", vehiclePlate: "51C-1" };
const view = (l: PlanVehicle["load"], canReadLoads: boolean, data?: LoadBooking, isError = false) =>
  bookingViewOf({ load: l, canReadLoads, data, isError });

describe("bookingViewOf", () => {
  it("is 'not booked' ONLY for a PLANNED load, whatever the permission", () => {
    expect(view(load("PLANNED"), false).kind).toBe("not-booked");
    expect(view(load("PLANNED"), true).kind).toBe("not-booked");
    for (const status of ["VEHICLE_BOOKED", "LOADING", "DISPATCHED"]) {
      expect(view(load(status), true).kind).not.toBe("not-booked");
      expect(view(load(status), false).kind).not.toBe("not-booked");
    }
  });

  it("has distinct states for no load, cancelled, no permission, loading, error and booked", () => {
    expect(view(undefined, true).kind).toBe("no-load");
    expect(view(null, true).kind).toBe("no-load");
    expect(view(load("CANCELLED"), true).kind).toBe("cancelled");
    expect(view(load("VEHICLE_BOOKED"), false).kind).toBe("no-permission");
    expect(view(load("VEHICLE_BOOKED"), true).kind).toBe("loading");
    expect(view(load("VEHICLE_BOOKED"), true, undefined, true).kind).toBe("error");
    expect(view(load("LOADING"), true, BOOKING)).toEqual({ kind: "booked", booking: BOOKING });
  });

  it("only the loading state keeps the print button waiting", () => {
    expect(bookingSettled({ kind: "loading" })).toBe(false);
    for (const kind of ["no-load", "not-booked", "cancelled", "no-permission", "error"] as const) {
      expect(bookingSettled({ kind })).toBe(true);
    }
    expect(bookingSettled({ kind: "booked", booking: BOOKING })).toBe(true);
  });
});

describe("bookingNeedsFetch", () => {
  it("fetches only booked-or-later loads the viewer may read", () => {
    expect(bookingNeedsFetch(load("VEHICLE_BOOKED"), true)).toBe(true);
    expect(bookingNeedsFetch(load("DISPATCHED"), true)).toBe(true);
    expect(bookingNeedsFetch(load("VEHICLE_BOOKED"), false)).toBe(false);
    expect(bookingNeedsFetch(load("PLANNED"), true)).toBe(false);
    expect(bookingNeedsFetch(load("CANCELLED"), true)).toBe(false);
    expect(bookingNeedsFetch(undefined, true)).toBe(false);
  });
});

describe("warehouseLabelOf", () => {
  const directory = [
    { warehouseId: "w1", code: "HN", name: "Kho Hà Nội" },
    { warehouseId: "w2", code: "", name: "Kho phụ" },
  ];

  it("prefers the name the dispatch load carries", () => {
    expect(warehouseLabelOf({ ...BOOKING, warehouseName: "Kho từ chuyến" }, directory, "w1")).toBe(
      "Kho từ chuyến",
    );
  });

  it("falls back to the directory by the plan's warehouse id, with its code when it has one", () => {
    expect(warehouseLabelOf(null, directory, "w1")).toBe("HN · Kho Hà Nội");
    expect(warehouseLabelOf(BOOKING, directory, "w2")).toBe("Kho phụ");
  });

  it("is null when neither knows the warehouse — never the raw id", () => {
    expect(warehouseLabelOf(null, directory, "w9")).toBeNull();
    expect(warehouseLabelOf(null, undefined, "w1")).toBeNull();
  });
});
