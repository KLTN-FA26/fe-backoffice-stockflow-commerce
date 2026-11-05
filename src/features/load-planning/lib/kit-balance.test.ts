import { describe, expect, it } from "vitest";

import { LAYOUT_40HC, KIT_BAN, LAYOUT_PICKUP_KIT } from "../__fixtures__/layouts";

import { computeKitBalance, deriveKitDefs } from "./kit-balance";

describe("computeKitBalance", () => {
  it("balanced: 4 tops + 16 legs is 4 complete sets of 1 top + 4 legs", () => {
    const balance = computeKitBalance([LAYOUT_PICKUP_KIT], [KIT_BAN]);
    expect(balance.ok).toBe(true);
    expect(balance.vehicles).toEqual([
      {
        vehicleSeq: 1,
        group: "KIT-BAN-01",
        sets: 4,
        counts: { "Mặt bàn": 4, "Chân bàn": 16 },
        unknownParts: [],
        unknownGroup: false,
      },
    ]);
  });

  it("unbalanced when a leg is missing: the table top and its legs no longer go together", () => {
    const legIndex = LAYOUT_PICKUP_KIT.boxes.findIndex((b) => b.partName === "Chân bàn");
    const boxes = LAYOUT_PICKUP_KIT.boxes.filter((_, i) => i !== legIndex);
    const balance = computeKitBalance([{ ...LAYOUT_PICKUP_KIT, boxes }], [KIT_BAN]);
    expect(balance.ok).toBe(false);
    expect(balance.vehicles[0]).toMatchObject({
      sets: null,
      counts: { "Mặt bàn": 4, "Chân bàn": 15 },
    });
  });

  it("unbalanced when the counts are equal but not in the set ratio (4 tops with only 4 legs)", () => {
    const tops = LAYOUT_PICKUP_KIT.boxes.filter((b) => b.partName === "Mặt bàn");
    const legs = LAYOUT_PICKUP_KIT.boxes.filter((b) => b.partName === "Chân bàn").slice(0, 4);
    const balance = computeKitBalance(
      [{ ...LAYOUT_PICKUP_KIT, boxes: [...tops, ...legs] }],
      [KIT_BAN],
    );
    expect(balance.ok).toBe(false);
    expect(balance.vehicles[0].counts).toEqual({ "Mặt bàn": 4, "Chân bàn": 4 });
  });

  it("each vehicle is checked on its own: a kit split unevenly between two vehicles fails", () => {
    const tops = LAYOUT_PICKUP_KIT.boxes.filter((b) => b.partName === "Mặt bàn");
    const legs = LAYOUT_PICKUP_KIT.boxes.filter((b) => b.partName === "Chân bàn");
    const a = { ...LAYOUT_PICKUP_KIT, seq: 1, boxes: [...tops.slice(0, 2), ...legs.slice(0, 8)] };
    const b = { ...LAYOUT_PICKUP_KIT, seq: 2, boxes: [...tops.slice(2), ...legs.slice(8, 12)] };
    const balance = computeKitBalance([a, b], [KIT_BAN]);
    expect(balance.vehicles.map((v) => v.sets)).toEqual([2, null]);
    expect(balance.ok).toBe(false);
  });

  it("has no entry for a vehicle without kit pieces, so nothing is shown for it (40HC)", () => {
    expect(computeKitBalance([LAYOUT_40HC], [KIT_BAN])).toEqual({ ok: true, vehicles: [] });
    const both = computeKitBalance([LAYOUT_40HC, { ...LAYOUT_PICKUP_KIT, seq: 2 }], [KIT_BAN]);
    expect(both.vehicles.map((v) => v.vehicleSeq)).toEqual([2]);
  });

  it("fails when a box of the group is not a part of the kit definition", () => {
    const stray = { ...LAYOUT_PICKUP_KIT.boxes[0], partName: "Lạ", yMm: 300 };
    const balance = computeKitBalance(
      [{ ...LAYOUT_PICKUP_KIT, boxes: [...LAYOUT_PICKUP_KIT.boxes, stray] }],
      [KIT_BAN],
    );
    expect(balance.ok).toBe(false);
    expect(balance.vehicles[0].unknownParts).toEqual(["Lạ"]);
  });

  it("reports a kitGroup with no definition as unknown instead of skipping it", () => {
    const balance = computeKitBalance([LAYOUT_PICKUP_KIT], []);
    expect(balance.ok).toBe(false);
    expect(balance.vehicles).toEqual([
      {
        vehicleSeq: 1,
        group: "KIT-BAN-01",
        sets: null,
        counts: {},
        unknownParts: [],
        unknownGroup: true,
      },
    ]);
    const other = { group: "KIT-KHAC", parts: [{ partName: "Mặt bàn", perSet: 1 }] };
    expect(computeKitBalance([LAYOUT_PICKUP_KIT], [other]).vehicles.map((v) => v.group)).toEqual([
      "KIT-BAN-01",
    ]);
  });

  it("has nothing to report when no box belongs to a kit", () => {
    expect(computeKitBalance([LAYOUT_40HC])).toEqual({ ok: true, vehicles: [] });
    expect(computeKitBalance([])).toEqual({ ok: true, vehicles: [] });
  });

  it("a part declared with perSet 0 can never balance", () => {
    const kit = { group: "KIT-BAN-01", parts: [{ partName: "Mặt bàn", perSet: 0 }] };
    expect(computeKitBalance([LAYOUT_PICKUP_KIT], [kit]).ok).toBe(false);
  });

  describe("derived definitions (the agreed Layout contract has no perSet)", () => {
    it("derives the smallest whole set from the plan totals: 4 tops + 16 legs → 1 + 4", () => {
      expect(deriveKitDefs([LAYOUT_PICKUP_KIT])).toEqual([
        {
          group: "KIT-BAN-01",
          parts: [
            { partName: "Mặt bàn", perSet: 1 },
            { partName: "Chân bàn", perSet: 4 },
          ],
        },
      ]);
      expect(deriveKitDefs([LAYOUT_40HC])).toEqual([]);
    });

    it("is the default: a plan whose vehicles each hold whole sets is balanced", () => {
      const tops = LAYOUT_PICKUP_KIT.boxes.filter((b) => b.partName === "Mặt bàn");
      const legs = LAYOUT_PICKUP_KIT.boxes.filter((b) => b.partName === "Chân bàn");
      const a = { ...LAYOUT_PICKUP_KIT, seq: 1, boxes: [...tops.slice(0, 2), ...legs.slice(0, 8)] };
      const b = { ...LAYOUT_PICKUP_KIT, seq: 2, boxes: [...tops.slice(2), ...legs.slice(8)] };
      const balance = computeKitBalance([a, b]);
      expect(balance.ok).toBe(true);
      expect(balance.vehicles.map((v) => v.sets)).toEqual([2, 2]);
    });

    it("flags a kit split across vehicles in the wrong proportions", () => {
      const tops = LAYOUT_PICKUP_KIT.boxes.filter((b) => b.partName === "Mặt bàn");
      const legs = LAYOUT_PICKUP_KIT.boxes.filter((b) => b.partName === "Chân bàn");
      const a = { ...LAYOUT_PICKUP_KIT, seq: 1, boxes: [...tops.slice(0, 2), ...legs.slice(0, 8)] };
      const b = { ...LAYOUT_PICKUP_KIT, seq: 2, boxes: [...tops.slice(2), ...legs.slice(8, 12)] };
      const balance = computeKitBalance([a, b]);
      expect(balance.ok).toBe(false);
      expect(balance.vehicles.map((v) => v.sets)).toEqual([null, null]);
    });
  });
});
