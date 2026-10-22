import { describe, expect, it } from "vitest";

import { LAYOUT_ORIENTATIONS } from "@/constants";

import { LAYOUT_40HC } from "../__fixtures__/layouts";

import {
  extentOf,
  formatLWH,
  formatM3,
  formatNominalCm,
  matchesOrientation,
  orientedExtent,
  volumeMm3,
} from "./dims";

describe("formatLWH", () => {
  it("shows length × width × height = z × x × y, never the stored w/h/d order", () => {
    // Thùng đặt: rộng(x)=400, cao(y)=300, dài(z)=800 → phiếu ghi D×R×C = 800×400×300
    expect(formatLWH({ wMm: 400, hMm: 300, dMm: 800 })).toBe("800×400×300mm");
    expect(formatLWH({ wMm: 400, hMm: 300, dMm: 800 }, "")).toBe("800×400×300");
  });
});

describe("formatNominalCm", () => {
  it("prints nominal l×w×h in centimetres", () => {
    expect(formatNominalCm({ l: 1000, w: 600, h: 500 })).toBe("100×60×50");
    expect(formatNominalCm({ l: 605, w: 405, h: 55 })).toBe("60,5×40,5×5,5");
  });
});

describe("orientedExtent", () => {
  const orig = { l: 1000, w: 600, h: 500 };

  it("LWH is the unrotated pose: length along z, width along x, height up", () => {
    expect(orientedExtent(orig, "LWH")).toEqual({ dMm: 1000, wMm: 600, hMm: 500 });
  });

  it("maps each letter to the axis it lies along (z, x, y order)", () => {
    expect(orientedExtent(orig, "WLH")).toEqual({ dMm: 600, wMm: 1000, hMm: 500 });
    expect(orientedExtent(orig, "HWL")).toEqual({ dMm: 500, wMm: 600, hMm: 1000 });
    expect(orientedExtent(orig, "LHW")).toEqual({ dMm: 1000, wMm: 500, hMm: 600 });
  });

  it("every orientation is a permutation of the nominal sides and keeps the volume", () => {
    const volume = orig.l * orig.w * orig.h;
    for (const orientation of LAYOUT_ORIENTATIONS) {
      const e = orientedExtent(orig, orientation);
      expect([e.dMm, e.wMm, e.hMm].sort((a, b) => a - b)).toEqual([500, 600, 1000]);
      expect(volumeMm3(e)).toBe(volume);
    }
  });
});

describe("extentOf", () => {
  it("maps the inner l/w/h to depth(z)/width(x)/height(y)", () => {
    expect(extentOf({ l: 12032, w: 2352, h: 2698 })).toEqual({ dMm: 12032, wMm: 2352, hMm: 2698 });
  });
});

describe("matchesOrientation", () => {
  it("accepts every fixture box and rejects a box whose size contradicts its orientation", () => {
    expect(LAYOUT_40HC.boxes.every((b) => matchesOrientation(b))).toBe(true);
    expect(matchesOrientation({ ...LAYOUT_40HC.boxes[0], wMm: 999 })).toBe(false);
  });

  it("tolerates rounding of up to 1 mm", () => {
    expect(matchesOrientation({ ...LAYOUT_40HC.boxes[0], wMm: LAYOUT_40HC.boxes[0].wMm + 1 })).toBe(
      true,
    );
  });
});

describe("formatM3", () => {
  it("shows cubic metres with two decimals (vi-VN)", () => {
    expect(formatM3(1_234_000_000)).toBe("1,23 m³");
    expect(formatM3(0)).toBe("0,00 m³");
  });
});
