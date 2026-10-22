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

  it("has zero utilisation without vehicles, not NaN", () => {
    expect(summarizeLayouts([]).utilization).toBe(0);
  });
});
