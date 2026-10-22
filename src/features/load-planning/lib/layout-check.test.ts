import { describe, expect, it } from "vitest";

import { LAYOUT_40HC, LAYOUT_PICKUP_KIT } from "../__fixtures__/layouts";

import { checkLayout } from "./layout-check";

describe("checkLayout", () => {
  it("accepts the realistic fixtures (they are physically valid)", () => {
    expect(checkLayout(LAYOUT_40HC)).toEqual([]);
    expect(checkLayout(LAYOUT_PICKUP_KIT)).toEqual([]);
  });

  it("flags a box dragged into its neighbour", () => {
    const boxes = LAYOUT_PICKUP_KIT.boxes.map((b, i) => (i === 0 ? { ...b, yMm: 10 } : b));
    const rules = checkLayout({ ...LAYOUT_PICKUP_KIT, boxes }).map((i) => i.rule);
    expect(rules).toContain("OVERLAP");
  });

  it("flags a floating box with the index and ref of the box", () => {
    const boxes = LAYOUT_PICKUP_KIT.boxes.map((b, i) => (i === 22 ? { ...b, yMm: 200 } : b));
    const issues = checkLayout({ ...LAYOUT_PICKUP_KIT, boxes });
    expect(issues).toContainEqual({ index: 22, ref: "LINE-103", rule: "INSUFFICIENT_SUPPORT" });
  });

  it("flags a box poking through the wall", () => {
    const boxes = LAYOUT_PICKUP_KIT.boxes.map((b, i) => (i === 22 ? { ...b, zMm: 1700 } : b));
    expect(checkLayout({ ...LAYOUT_PICKUP_KIT, boxes }).map((i) => i.rule)).toContain(
      "OUT_OF_BOUNDS",
    );
  });

  it("flags a box that overlaps a gusset", () => {
    const [gusset] = LAYOUT_40HC.gussets;
    const intruder = { ...LAYOUT_40HC.boxes[0], ...gusset, yMm: gusset.yMm };
    expect(checkLayout({ ...LAYOUT_40HC, boxes: [intruder] }).map((i) => i.rule)).toContain(
      "OVERLAP",
    );
  });

  it("flags a placed size that contradicts the orientation", () => {
    const boxes = LAYOUT_PICKUP_KIT.boxes.map((b, i) =>
      i === 0 ? { ...b, orientation: "WLH" as const } : b,
    );
    expect(checkLayout({ ...LAYOUT_PICKUP_KIT, boxes })).toContainEqual({
      index: 0,
      ref: "LINE-101",
      rule: "ORIENTATION_MISMATCH",
    });
  });

  it("flags a vehicle over its payload", () => {
    expect(checkLayout({ ...LAYOUT_PICKUP_KIT, maxPayloadKg: 100 })).toContainEqual({
      index: null,
      ref: null,
      rule: "PAYLOAD_EXCEEDED",
    });
  });
});
