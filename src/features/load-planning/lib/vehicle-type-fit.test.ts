import { describe, expect, it } from "vitest";

import { fitsInOne, orderVehicleTypes, vehicleTypeSize } from "./vehicle-type-fit";

import type { FitVehicleType } from "./vehicle-type-fit";

const type = (code: string, name: string, payloadKg: number, l: number, w: number, h: number) =>
  ({
    vehicleTypeId: code,
    code,
    name,
    innerLengthMm: l,
    innerWidthMm: w,
    innerHeightMm: h,
    maxPayloadKg: payloadKg,
  }) satisfies FitVehicleType;

const PICKUP = type("PICKUP", "Pickup truck (xe bán tải)", 800, 1500, 1140, 500);
const T125 = type("TRUCK-1T25", "Box truck 1.25 t (xe tải 1,25 tấn)", 1250, 3100, 1600, 1600);
const T5 = type("TRUCK-5T", "Box truck 5 t (xe tải 5 tấn)", 5000, 5200, 2050, 2050);
const DC20 = type("20DC", "Container 20' Dry (20DC)", 28200, 5898, 2352, 2393);

describe("vehicleTypeSize", () => {
  it("writes metres with one decimal, not 3,100 × 1,600 × 1,600", () => {
    expect(vehicleTypeSize(T125)).toBe("3,1 × 1,6 × 1,6");
  });
});

describe("orderVehicleTypes", () => {
  const all = [DC20, T5, T125, PICKUP];

  it("puts what fits one vehicle first, smallest first, so a container for 95 kg comes last", () => {
    const load = { weightKg: 95, volumeMm3: 500_000_000 };
    const ordered = orderVehicleTypes(all, load);
    expect(ordered.fitting.map((t) => t.code)).toEqual([
      "PICKUP",
      "TRUCK-1T25",
      "TRUCK-5T",
      "20DC",
    ]);
    expect(ordered.others).toEqual([]);
  });

  it("sends a type too small for one vehicle after the ones that fit", () => {
    const load = { weightKg: 95, volumeMm3: 930_000_000 };
    expect(fitsInOne(PICKUP, load)).toBe(false);
    const ordered = orderVehicleTypes(all, load);
    expect(ordered.fitting.map((t) => t.code)).toEqual(["TRUCK-1T25", "TRUCK-5T", "20DC"]);
    expect(ordered.others.map((t) => t.code)).toEqual(["PICKUP"]);
  });

  it("puts the types of the load estimate first even when one vehicle does not hold the load", () => {
    const load = { weightKg: 95, volumeMm3: 930_000_000 };
    const ordered = orderVehicleTypes(all, load, new Set(["PICKUP"]));
    expect(ordered.fitting.map((t) => t.code)[0]).toBe("PICKUP");
  });

  it("has no basis for a group when no shipment is chosen: payload order, nothing set apart", () => {
    const ordered = orderVehicleTypes(all, { weightKg: 0, volumeMm3: 0 });
    expect(ordered.fitting.map((t) => t.code)).toEqual([
      "PICKUP",
      "TRUCK-1T25",
      "TRUCK-5T",
      "20DC",
    ]);
    expect(ordered.others).toEqual([]);
  });
});
