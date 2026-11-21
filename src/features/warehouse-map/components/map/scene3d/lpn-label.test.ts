import { describe, expect, it } from "vitest";

import { LPN_LABEL_MAX, lpnAtlas, lpnLabelGeometry } from "./lpn-label";

import type { CartonPart } from "@/features/warehouse-map/cartons-3d";

const carton = (i: number, size: [number, number, number] = [0.4, 0.3, 0.3]): CartonPart => ({
  position: [i, 0, 0],
  size,
  yaw: 0,
  shade: 0,
  lpn: `LPN-${i}`,
});

const uvRange = (count: number, size?: [number, number, number]) => {
  const geometry = lpnLabelGeometry(Array.from({ length: count }, (_, i) => carton(i, size)));
  const uv = geometry?.attributes.uv;
  const values = uv ? Array.from(uv.array) : [];
  return { geometry, min: Math.min(...values), max: Math.max(...values) };
};

describe("tem LPN (atlas)", () => {
  it("không thùng nào → không có hình", () => {
    expect(lpnLabelGeometry([])).toBeNull();
  });

  it("atlas tối đa vẫn nằm gọn trong texture 4096 px — mọi UV trong [0, 1]", () => {
    expect(LPN_LABEL_MAX).toBeGreaterThanOrEqual(300);
    const lpns = Array.from({ length: LPN_LABEL_MAX }, (_, i) => `LPN-${i}`);
    const atlas = lpnAtlas(lpns, { label: "white", print: "black" });
    const image: unknown = atlas.image;
    expect(image).toBeInstanceOf(HTMLCanvasElement);
    if (image instanceof HTMLCanvasElement) {
      expect(image.width).toBeLessThanOrEqual(4096);
      expect(image.height).toBeLessThanOrEqual(4096);
    }
    const { min, max } = uvRange(LPN_LABEL_MAX);
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(1);
  });

  it("mặt thùng nhỏ → tem co đều, giữ tỉ lệ 3:2", () => {
    const { geometry } = uvRange(1, [0.1, 0.3, 0.1]);
    geometry?.computeBoundingBox();
    const box = geometry?.boundingBox;
    const width = (box?.max.x ?? 0) - (box?.min.x ?? 0);
    const height = (box?.max.y ?? 0) - (box?.min.y ?? 0);
    expect(width / height).toBeCloseTo(1.5);
  });
});
