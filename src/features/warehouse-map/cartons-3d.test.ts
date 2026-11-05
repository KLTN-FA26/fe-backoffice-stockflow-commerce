import { describe, expect, it } from "vitest";

import { LAYOUT } from "./__fixtures__/layout";
import { cartonParts, overviewPose, shelfFocusPose, stockByLocation } from "./cartons-3d";
import { rackParts } from "./rack-3d";

const [A01] = LAYOUT.shelves;
if (!A01) throw new Error("fixture thiếu kệ A01");
const BIN_A = "HCM-A01-1-A";

const cartons = (stock: Map<string, number | null>) => cartonParts(A01, stock);

describe("stockByLocation — tồn theo vị trí", () => {
  it("cộng các dòng cùng vị trí; dòng ẩn số lượng (đang kiểm kê) → null", () => {
    const totals = stockByLocation([
      { locationCode: BIN_A, sku: "SOFA-1", onHand: 10 },
      { locationCode: BIN_A, sku: "SOFA-2", onHand: 5 },
      { locationCode: "HCM-A01-2-A", sku: "SOFA-3", onHand: null },
      { locationCode: "HCM-A01-2-A", sku: "SOFA-4", onHand: 4 },
    ]);
    expect(totals.get(BIN_A)).toBe(15);
    expect(totals.get("HCM-A01-2-A")).toBeNull();
  });
});

describe("cartonParts — thùng carton chỉ ở bin có tồn (BR-05: theo tồn, không bịa)", () => {
  it("không có dòng tồn → không có thùng", () => {
    expect(cartonParts(A01, new Map())).toEqual([]);
  });

  it("số thùng quy từ số lượng, tối thiểu 1, tối đa đầy pallet; không rõ số lượng → nửa pallet", () => {
    // Pallet 2 × 2 thùng mỗi lớp, tầng cao 1.4 m → 3 lớp = 12 thùng
    expect(cartons(new Map([[BIN_A, 30]]))).toHaveLength(3);
    expect(cartons(new Map([[BIN_A, 1]]))).toHaveLength(1);
    expect(cartons(new Map([[BIN_A, 10_000]]))).toHaveLength(12);
    expect(cartons(new Map([[BIN_A, null]]))).toHaveLength(6);
  });

  it("mặt in tem của thùng quay ra lối lấy hàng (mặt nam; kệ chỉ mở mặt bắc thì quay ngược)", () => {
    const stock = new Map([[BIN_A, 30]]);
    for (const { yaw } of cartonParts(A01, stock)) expect(Math.abs(yaw)).toBeLessThan(0.05);
    const north = { ...A01, pickFaces: { north: true, east: false, south: false, west: false } };
    for (const { yaw } of cartonParts(north, stock))
      expect(Math.abs(yaw - Math.PI)).toBeLessThan(0.05);
  });

  it("thùng nằm trên mặt pallet và trong mặt bằng của kệ; vẽ lại y hệt (không ngẫu nhiên)", () => {
    const stock = new Map([[BIN_A, 30]]);
    const first = cartons(stock);
    expect(cartonParts(A01, stock)).toEqual(cartonParts(A01, stock));
    for (const { position, size } of first) {
      expect(position[1] - size[1] / 2).toBeGreaterThanOrEqual(0.14 - 1e-9);
      expect(position[0]).toBeGreaterThan(5);
      expect(position[0]).toBeLessThan(15);
      expect(position[2]).toBeGreaterThan(5);
      expect(position[2]).toBeLessThan(6.2);
    }
  });

  it("bin thường có hàng → bỏ thùng nhựa rỗng ở đó (thùng carton thay chỗ)", () => {
    const shelving = {
      ...A01,
      levels: A01.levels.map((level) => ({
        ...level,
        bins: level.bins.map((bin) => ({ ...bin, type: "STANDARD" as const })),
      })),
    };
    const totes = (stocked?: Set<string>) =>
      rackParts(shelving, stocked).filter((part) => part.kind === "tote").length;
    expect(totes()).toBe(3);
    expect(totes(new Set([BIN_A]))).toBe(2);
  });
});

describe("đích camera", () => {
  it("bay tới kệ: camera đứng phía mặt lấy hàng (nam), nhìn vào giữa kệ", () => {
    const { position, target } = shelfFocusPose(A01);
    expect(target[0]).toBeCloseTo(10);
    expect(target[2]).toBeCloseTo(5.6);
    expect(position[2]).toBeGreaterThan(target[2]);
    expect(position[1]).toBeGreaterThan(target[1]);
  });

  it("kệ chỉ mở mặt bắc → camera đứng phía bắc", () => {
    const north = { ...A01, pickFaces: { north: true, east: false, south: false, west: false } };
    const { position, target } = shelfFocusPose(north);
    expect(position[2]).toBeLessThan(target[2]);
  });

  it("toàn cảnh nhìn vào giữa kho", () => {
    expect(overviewPose(60, 40).target).toEqual([30, 0, 20]);
  });
});
