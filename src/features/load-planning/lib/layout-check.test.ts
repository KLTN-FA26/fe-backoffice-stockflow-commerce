import { describe, expect, it } from "vitest";

import { LAYOUT_40HC, LAYOUT_PICKUP_KIT } from "../__fixtures__/layouts";

import { checkLayout, findDuplicateRefs } from "./layout-check";

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
    expect(issues).toContainEqual({ index: 22, ref: "PKG-103-003", rule: "UNSUPPORTED" });
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
    const rules = checkLayout({ ...LAYOUT_40HC, boxes: [intruder] }).map((i) => i.rule);
    expect(rules).toContain("GUSSET");
    expect(rules).not.toContain("OVERLAP");
  });

  it("flags a placed size that contradicts the orientation", () => {
    const boxes = LAYOUT_PICKUP_KIT.boxes.map((b, i) =>
      i === 0 ? { ...b, orientation: "WLH" as const } : b,
    );
    expect(checkLayout({ ...LAYOUT_PICKUP_KIT, boxes })).toContainEqual({
      index: 0,
      ref: "PKG-101-001",
      rule: "ORIENTATION_MISMATCH",
    });
  });

  it("flags a non-rotatable box that is not in its original pose (BR-10)", () => {
    const shelf = LAYOUT_40HC.boxes.findIndex((b) => b.partName === "Kệ sách");
    expect(LAYOUT_40HC.boxes[shelf].rotatable).toBe(false);
    // xoay kệ cao nằm xuống: kích thước đã xếp khớp hướng mới, nên chỉ vi phạm cờ xoay
    const original = LAYOUT_40HC.boxes[shelf];
    const turned = {
      ...original,
      orientation: "HWL" as const,
      wMm: original.origMm.w,
      hMm: original.origMm.l,
      dMm: original.origMm.h,
    };
    const boxes = LAYOUT_40HC.boxes.map((b, i) => (i === shelf ? turned : b));
    const issues = checkLayout({ ...LAYOUT_40HC, boxes });
    expect(issues).toContainEqual({
      index: shelf,
      ref: "LINE-004#1",
      rule: "ROTATION_NOT_ALLOWED",
    });
  });

  it("lets a rotatable box be turned freely", () => {
    // Bàn trà trong fixture đã xoay WLH và hợp lệ
    expect(LAYOUT_40HC.boxes.some((b) => b.orientation === "WLH" && b.rotatable)).toBe(true);
    expect(checkLayout(LAYOUT_40HC)).toEqual([]);
  });

  it("flags a vehicle over its payload", () => {
    expect(checkLayout({ ...LAYOUT_PICKUP_KIT, maxPayloadKg: 100 })).toContainEqual({
      index: null,
      ref: null,
      rule: "OVERWEIGHT",
    });
  });
});

describe("findDuplicateRefs (ref is unique per box within a plan)", () => {
  it("accepts a plan whose refs never repeat", () => {
    expect(findDuplicateRefs([LAYOUT_40HC, LAYOUT_PICKUP_KIT])).toEqual([]);
  });

  it("finds a ref reused in another vehicle, which the per-vehicle schema cannot see", () => {
    const second = { ...LAYOUT_PICKUP_KIT, seq: 2 };
    expect(findDuplicateRefs([LAYOUT_PICKUP_KIT, second])).toHaveLength(
      LAYOUT_PICKUP_KIT.boxes.length,
    );
    expect(findDuplicateRefs([LAYOUT_PICKUP_KIT, second])).toContain("PKG-101-001");
  });

  it("reports each repeated ref once", () => {
    const box = LAYOUT_PICKUP_KIT.boxes[0];
    expect(findDuplicateRefs([{ boxes: [box, box, box] }])).toEqual(["PKG-101-001"]);
  });
});
