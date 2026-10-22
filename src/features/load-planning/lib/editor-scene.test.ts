import { describe, expect, it } from "vitest";

import { SCENE_COLORS } from "@/constants";

import { LAYOUT_PICKUP_KIT } from "../__fixtures__/layouts";

import { extentOf } from "./dims";
import { boxEdgePositions, buildEditorBoxes, mixHex, toneColor } from "./editor-scene";
import { buildColorMap } from "./palette";
import { sceneScale } from "./scene";

describe("buildEditorBoxes", () => {
  const extent = extentOf(LAYOUT_PICKUP_KIT.innerMm);
  const scale = sceneScale(extent);
  const colors = buildColorMap(LAYOUT_PICKUP_KIT.boxes.map((b) => b.partName));
  const boxes = buildEditorBoxes(LAYOUT_PICKUP_KIT.boxes, extent, scale, colors);

  it("keeps every box (no truncation at renderBoxesMax) in the same order, keyed by ref", () => {
    expect(boxes.map((b) => b.ref)).toEqual(LAYOUT_PICKUP_KIT.boxes.map((b) => b.ref));
    const many = Array.from({ length: 900 }, (_, i) => ({
      ...LAYOUT_PICKUP_KIT.boxes[0],
      ref: `r${i}`,
    }));
    expect(buildEditorBoxes(many, extent, scale, colors)).toHaveLength(900);
  });

  it("centres the scene on the vehicle: a box in the min corner sits at negative x/y/z", () => {
    const corner = boxes.find(
      (_, i) => LAYOUT_PICKUP_KIT.boxes[i].xMm === 0 && LAYOUT_PICKUP_KIT.boxes[i].zMm === 0,
    );
    expect(corner?.position[0]).toBeLessThan(0);
    expect(corner?.position[2]).toBeLessThan(0);
  });

  it("colours by item name and labels with the name and the package code", () => {
    expect(boxes[0].baseColor).toBe(colors.get(LAYOUT_PICKUP_KIT.boxes[0].partName));
    expect(boxes[0].label).toContain(LAYOUT_PICKUP_KIT.boxes[0].label);
  });
});

describe("toneColor", () => {
  it("violation beats selection, selection beats the item colour, hover only lightens", () => {
    expect(toneColor("#60a5fa", "violation")).toBe(SCENE_COLORS.violation);
    expect(toneColor("#60a5fa", "selected")).toBe(SCENE_COLORS.selected);
    expect(toneColor("#60a5fa", "idle")).toBe("#60a5fa");
    const hover = toneColor("#000000", "hover");
    expect(hover).not.toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("falls back to the first colour when a hex cannot be parsed", () => {
    expect(mixHex("red", "#ffffff", 0.5)).toBe("red");
  });
});

describe("boxEdgePositions", () => {
  it("emits 12 segments (24 vertices) per box, all on the box surface", () => {
    const out = boxEdgePositions([{ position: [1, 2, 3], size: [2, 4, 6] }]);
    expect(out).toHaveLength(12 * 2 * 3);
    for (let i = 0; i < out.length; i += 3) {
      expect([0, 2]).toContain(out[i]);
      expect([0, 4]).toContain(out[i + 1]);
      expect([0, 6]).toContain(out[i + 2]);
    }
  });

  it("each of the 8 corners is used by exactly 3 edges", () => {
    const out = boxEdgePositions([{ position: [0, 0, 0], size: [1, 1, 1] }]);
    const counts = new Map<string, number>();
    for (let i = 0; i < out.length; i += 3) {
      const key = `${out[i]},${out[i + 1]},${out[i + 2]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(8);
    expect([...counts.values()].every((n) => n === 3)).toBe(true);
  });
});
