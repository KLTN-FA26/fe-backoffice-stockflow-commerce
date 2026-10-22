import { describe, expect, it } from "vitest";

import { CAPTURE_PALETTE, VIEWER_PALETTE } from "@/constants";

import { LAYOUT_40HC, LAYOUT_PICKUP_KIT } from "../__fixtures__/layouts";

import { buildColorMap, colorMapForLayouts, colorMapForPrint, colorOf } from "./palette";

describe("buildColorMap", () => {
  it("assigns by sorted name, so the colours depend on the set of names, not their order", () => {
    const a = buildColorMap(["Ghế ăn", "Bàn trà", "Kệ sách"]);
    const b = buildColorMap(["Kệ sách", "Ghế ăn", "Bàn trà", "Ghế ăn"]);
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
    expect(a.get("Bàn trà")).toBe(VIEWER_PALETTE[0]);
    expect(a.get("Ghế ăn")).toBe(VIEWER_PALETTE[1]);
    expect(a.get("Kệ sách")).toBe(VIEWER_PALETTE[2]);
  });

  it("sorts Vietnamese names by vi collation", () => {
    const map = buildColorMap(["Ế", "Z", "A"]);
    expect([...map.keys()]).toEqual(["A", "Ế", "Z"]);
  });

  it("gives distinct names distinct colours until the palette runs out, then cycles", () => {
    const names = Array.from(
      { length: VIEWER_PALETTE.length + 2 },
      (_, i) => `item-${String(i).padStart(2, "0")}`,
    );
    const map = buildColorMap(names);
    const colors = names.map((n) => map.get(n));
    expect(new Set(colors.slice(0, VIEWER_PALETTE.length)).size).toBe(VIEWER_PALETTE.length);
    expect(colors[VIEWER_PALETTE.length]).toBe(colors[0]);
    expect(colors[VIEWER_PALETTE.length + 1]).toBe(colors[1]);
  });

  it("gives a real layout the same map whatever the order of its boxes", () => {
    const names = LAYOUT_40HC.boxes.map((b) => b.partName);
    expect([...buildColorMap(names)]).toEqual([...buildColorMap([...names].reverse())]);
  });

  it("only produces six-digit hex colours from the chosen palette", () => {
    for (const palette of [VIEWER_PALETTE, CAPTURE_PALETTE]) {
      for (const color of palette) expect(color).toMatch(/^#[0-9a-f]{6}$/);
      expect(new Set(palette).size).toBe(palette.length);
    }
  });
});

/** Hue 0-360 của màu hex (HSL). */
function hueOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (delta === 0) return 0;
  const sector =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (sector * 60 + 360) % 360;
}

describe("palettes follow the repo's colour rules", () => {
  it("contain no pink or magenta (CLAUDE.md: không dùng màu hồng/magenta)", () => {
    // hồng/magenta/fuchsia nằm khoảng hue 290–350; đỏ-hồng của rose cũng bị loại
    for (const color of [...VIEWER_PALETTE, ...CAPTURE_PALETTE]) {
      const hue = hueOf(color);
      expect(hue < 285 || hue > 350, `${color} has hue ${Math.round(hue)}`).toBe(true);
    }
  });
});

describe("colorMapForLayouts", () => {
  it("shares one colour per part across all vehicles of a plan", () => {
    const map = colorMapForLayouts([LAYOUT_40HC, LAYOUT_PICKUP_KIT]);
    expect(map.size).toBe(8);
    const alone = colorMapForLayouts([LAYOUT_PICKUP_KIT]);
    // Cùng tên nhưng bảng màu khác nhau khi tập tên khác nhau: lý do chia chung một map cho cả kế hoạch.
    expect(alone.get("Mặt bàn")).not.toBe(map.get("Mặt bàn"));
  });

  it("uses the lighter print palette for the print map", () => {
    const map = colorMapForPrint([LAYOUT_PICKUP_KIT]);
    for (const color of map.values()) expect(CAPTURE_PALETTE).toContain(color);
  });
});

describe("colorOf", () => {
  it("falls back to the first palette slot for an unknown name", () => {
    expect(colorOf(new Map(), "lạ")).toBe(VIEWER_PALETTE[0]);
  });
});
