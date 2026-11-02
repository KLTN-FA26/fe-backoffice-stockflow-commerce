import { describe, expect, it } from "vitest";

import { LAYOUT } from "./__fixtures__/layout";
import { bayEdges, rackParts } from "./rack-3d";
import { boxOf } from "./selectors";

import type { LayoutShelf } from "./types";

const [A01] = LAYOUT.shelves;
if (!A01) throw new Error("fixture thiếu kệ A01");

const count = (shelf: LayoutShelf, kind: string) =>
  rackParts(shelf).filter((part) => part.kind === kind).length;

describe("rackParts — kệ pallet 3D dựng từ dữ liệu kệ", () => {
  it("ranh khoang theo mép kệ + mép bin của tầng thấp nhất", () => {
    expect(bayEdges(A01)).toEqual([0, 5, 10]);
    expect(bayEdges({ ...A01, levels: [] })).toEqual([0, 10]);
  });

  it("mỗi khung có cột trước + sau và giằng chéo; beam + sàn lưới chỉ ở tầng trên cao", () => {
    // 3 khung (0, 5, 10) × 2 cột
    expect(count(A01, "upright")).toBe(6);
    // Cao 3 m (tầng 2: 1.5 + 1.4, +0.1 đỉnh cột) → 2 giằng mỗi khung
    expect(count(A01, "brace")).toBe(6);
    // Tầng 1 sát sàn không beam; tầng 2: 2 khoang × beam trước / sau, 1 sàn mỗi khoang
    expect(count(A01, "beam")).toBe(4);
    expect(count(A01, "deck")).toBe(2);
  });

  it("bin PALLET dựng pallet, loại khác dựng thùng — không vẽ hàng (BR-05)", () => {
    expect(count(A01, "pallet")).toBe(3);
    expect(count(A01, "tote")).toBe(0);
    const shelving = {
      ...A01,
      levels: A01.levels.map((level) => ({
        ...level,
        bins: level.bins.map((bin) => ({ ...bin, type: "SMALL_PARTS" as const })),
      })),
    };
    expect(count(shelving, "pallet")).toBe(0);
    expect(count(shelving, "tote")).toBe(3);
  });

  it("nhãn vị trí mang trạng thái bin để tô màu (BR-16 effectiveStatus)", () => {
    const labels = rackParts(A01).filter((part) => part.kind === "label");
    expect(labels).toHaveLength(3);
    expect(labels.map((label) => [label.binUsable, label.binStatus])).toEqual([
      [true, "ACTIVE"],
      [false, "BLOCKED"],
      [true, "ACTIVE"],
    ]);
  });

  it.each([0, 90, 180, 270])("xoay %i°: mọi cột nằm trong mặt bằng của kệ như 2D", (rotation) => {
    const shelf = { ...A01, footprint: { ...A01.footprint, rotation } };
    const box = boxOf(shelf.footprint);
    const uprights = rackParts(shelf).filter((part) => part.kind === "upright");
    for (const { position } of uprights) {
      const [x, , z] = position;
      expect(x).toBeGreaterThanOrEqual(box.x - 1e-9);
      expect(x).toBeLessThanOrEqual(box.x + box.w + 1e-9);
      expect(z).toBeGreaterThanOrEqual(box.y - 1e-9);
      expect(z).toBeLessThanOrEqual(box.y + box.h + 1e-9);
    }
  });

  it("kệ không tầng vẫn có khung cột ở hai đầu, không pallet / nhãn", () => {
    const empty = { ...A01, levels: [] };
    expect(count(empty, "upright")).toBe(4);
    expect(count(empty, "pallet")).toBe(0);
    expect(count(empty, "label")).toBe(0);
  });
});
