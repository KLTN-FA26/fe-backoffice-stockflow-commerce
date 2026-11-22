import { describe, expect, it } from "vitest";

import { WAREHOUSE_MAP_3D as R } from "@/constants";

import { LAYOUT } from "./__fixtures__/layout";
import { rackParts } from "./rack-3d";
import { railBoxes } from "./rack-rails";

import type { LayoutShelf } from "./types";

const [A01] = LAYOUT.shelves;
if (!A01) throw new Error("fixture thiếu kệ A01");

const OPEN = { north: true, east: true, south: true, west: true };
const rails = (shelf: LayoutShelf) => rackParts(shelf).filter((part) => part.kind === "rail");

describe("thanh chắn ở mặt không lấy hàng (BR-08)", () => {
  it("kệ chỉ mở mặt nam → thanh chắn ở bắc, đông, tây; không ở nam — mỗi mặt một thanh mỗi tầng", () => {
    const boxes = railBoxes(A01);
    const { width, length } = A01.footprint;
    // A01: 2 tầng × 3 mặt đóng
    expect(boxes).toHaveLength(2 * 3);
    // Ngay ngoài hàng cột: bắc z < 0, tây x < 0, đông x > rộng — không thanh nào ở mặt nam (z > dài)
    expect(boxes.filter((box) => box.z < 0)).toHaveLength(2);
    expect(boxes.filter((box) => box.x < 0)).toHaveLength(2);
    expect(boxes.filter((box) => box.x > width)).toHaveLength(2);
    expect(boxes.some((box) => box.z > length)).toBe(false);
    // Thanh mặt bắc chạy suốt bề rộng kệ
    expect(boxes.find((box) => box.z < 0)?.w).toBeGreaterThanOrEqual(width);
  });

  it("đủ bốn mặt lấy hàng → không có thanh chắn", () => {
    expect(rails({ ...A01, pickFaces: OPEN })).toEqual([]);
  });

  it("mỗi tầng một thanh ở giữa khoảng trống của tầng, trong chiều cao kệ", () => {
    const heights = [...new Set(railBoxes(A01).map((box) => box.y))].sort((a, b) => a - b);
    const spans = A01.levels.map((level) => [level.elevation ?? 0, level.usableHeight ?? 0]);
    expect(heights).toEqual(spans.map(([bottom = 0, height = 0]) => bottom + height / 2));
  });

  it("kệ xoay 90° → thanh vẫn nằm đúng mặt cục bộ như 2D (nam cục bộ thành mép tây trên bản đồ)", () => {
    const { x, y, width, length } = A01.footprint;
    const turned: LayoutShelf = {
      ...A01,
      footprint: { ...A01.footprint, rotation: 90 },
      pickFaces: { north: true, east: true, south: false, west: true },
    };
    const parts = rails(turned);
    expect(parts).toHaveLength(A01.levels.length);
    // Nam cục bộ (z = dài) xoay 90° theo chiều kim đồng hồ → mép tây của khối trên bản đồ
    const box = { minX: x, maxX: x + length, minY: y, maxY: y + width };
    for (const part of parts) {
      expect(part.position[0]).toBeLessThan(box.minX + R.post);
      expect(part.position[2]).toBeGreaterThan(box.minY);
      expect(part.position[2]).toBeLessThan(box.maxY);
    }
  });
});
