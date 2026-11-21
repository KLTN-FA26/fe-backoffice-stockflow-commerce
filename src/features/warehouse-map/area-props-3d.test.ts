import { describe, expect, it } from "vitest";

import { AREA_TYPES } from "@/constants";

import { LAYOUT } from "./__fixtures__/layout";
import { areaPropParts } from "./area-props-3d";
import { boxOf } from "./selectors";

import type { LayoutArea } from "./types";

const base = LAYOUT.areas[0];
if (!base) throw new Error("fixture thiếu khu vực");
const area = (patch: Partial<LayoutArea>): LayoutArea => ({
  ...base,
  footprint: { x: 10, y: 4, width: 6, length: 5, rotation: 0 },
  ...patch,
});

describe("areaPropParts — thiết bị theo loại khu (docs 06 §5)", () => {
  it("mỗi loại khu chứa hàng có bộ thiết bị riêng; NON_STORAGE không có", () => {
    for (const type of AREA_TYPES) {
      const parts = areaPropParts([area({ id: type, type })]);
      if (type === "NON_STORAGE") expect(parts).toEqual([]);
      else expect(parts.length).toBeGreaterThan(0);
    }
  });

  it("thiết bị nằm trong khung khu, kể cả khu xoay 90°", () => {
    const turned = area({
      type: "QUARANTINE",
      footprint: { x: 3, y: 2, width: 6, length: 3, rotation: 90 },
    });
    const b = boxOf(turned.footprint);
    for (const part of areaPropParts([turned])) {
      const [x, , z] = part.position;
      expect(x).toBeGreaterThanOrEqual(b.x);
      expect(x).toBeLessThanOrEqual(b.x + b.w);
      expect(z).toBeGreaterThanOrEqual(b.y);
      expect(z).toBeLessThanOrEqual(b.y + b.h);
    }
  });

  it("bỏ khu vật cản, khu không ACTIVE, khu quá nhỏ", () => {
    expect(areaPropParts([area({ type: "RECEIVING", obstacle: true })])).toEqual([]);
    expect(areaPropParts([area({ type: "RECEIVING", effectiveStatus: "BLOCKED" })])).toEqual([]);
    const tiny = area({
      type: "RECEIVING",
      footprint: { x: 0, y: 0, width: 1.5, length: 4, rotation: 0 },
    });
    expect(areaPropParts([tiny])).toEqual([]);
  });

  it("BR-05: không vẽ hàng — chỉ thiết bị, không có pallet / thùng", () => {
    const kinds = new Set(
      AREA_TYPES.flatMap((type) => areaPropParts([area({ id: type, type })]).map((p) => p.kind)),
    );
    expect([...kinds].sort()).toEqual(["belt", "hazard", "metal", "rubber", "sign", "top"]);
  });
});
