import { describe, expect, it } from "vitest";

import { LAYOUT_40HC, LAYOUT_PICKUP_KIT } from "./__fixtures__/layouts";
import { summarizeLayouts } from "./selectors";

describe("summarizeLayouts", () => {
  it("totals one vehicle", () => {
    const s = summarizeLayouts([LAYOUT_PICKUP_KIT]);
    expect(s).toMatchObject({
      vehicles: 1,
      pieces: 23,
      usedWeightKg: 133,
      payloadKg: 1000,
      unplacedPieces: 0,
    });
    expect(s.capacityMm3).toBe(1800 * 1500 * 500);
    expect(s.utilization).toBeCloseTo(s.usedVolumeMm3 / (1800 * 1500 * 500), 12);
  });

  it("totals several vehicles and carries the unplaced count", () => {
    const s = summarizeLayouts([LAYOUT_40HC, LAYOUT_PICKUP_KIT], 15);
    expect(s.vehicles).toBe(2);
    expect(s.pieces).toBe(438 + 23);
    expect(s.payloadKg).toBe(26380 + 1000);
    expect(s.unplacedPieces).toBe(15);
    expect(s.capacityMm3).toBe(12032 * 2352 * 2698 + 1800 * 1500 * 500);
  });

  it("counts overweight vehicles one by one, never from the plan total (BR-10 is per vehicle)", () => {
    // xe 1: 1200/1000 kg (quá tải), xe 2: 100/5000 kg — tổng 1300/6000 trông vẫn ổn
    const heavy = { ...LAYOUT_PICKUP_KIT, seq: 1, usedWeightKg: 1200, maxPayloadKg: 1000 };
    const light = { ...LAYOUT_PICKUP_KIT, seq: 2, usedWeightKg: 100, maxPayloadKg: 5000 };
    expect(summarizeLayouts([heavy, light]).overweightVehicles).toBe(1);
    expect(summarizeLayouts([light]).overweightVehicles).toBe(0);
    expect(summarizeLayouts([heavy, { ...heavy, seq: 2 }]).overweightVehicles).toBe(2);
  });

  it("a vehicle exactly at its payload is not overweight", () => {
    expect(
      summarizeLayouts([{ ...LAYOUT_PICKUP_KIT, usedWeightKg: 1000, maxPayloadKg: 1000 }])
        .overweightVehicles,
    ).toBe(0);
  });

  it("has zero utilisation without vehicles, not NaN", () => {
    expect(summarizeLayouts([]).utilization).toBe(0);
  });
});
