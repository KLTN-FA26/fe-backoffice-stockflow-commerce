import { describe, expect, it } from "vitest";

import { LAYOUT_40HC, KIT_BAN, LAYOUT_PICKUP_KIT } from "../__fixtures__/layouts";

import { computeKitBalance } from "./kit-balance";

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

  it("a vehicle with no pieces of the kit is trivially balanced (0 sets)", () => {
    const balance = computeKitBalance([LAYOUT_40HC], [KIT_BAN]);
    expect(balance.ok).toBe(true);
    expect(balance.vehicles[0].sets).toBe(0);
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

  it("ignores boxes of other groups and has nothing to report without kits", () => {
    expect(computeKitBalance([LAYOUT_PICKUP_KIT], [])).toEqual({ ok: true, vehicles: [] });
  });

  it("a part declared with perSet 0 can never balance", () => {
    const kit = { group: "KIT-BAN-01", parts: [{ partName: "Mặt bàn", perSet: 0 }] };
    expect(computeKitBalance([LAYOUT_PICKUP_KIT], [kit]).ok).toBe(false);
  });
});
