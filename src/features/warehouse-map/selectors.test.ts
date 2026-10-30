import { describe, expect, it } from "vitest";

import { LAYOUT } from "./__fixtures__/layout";
import {
  boxesOverlap,
  boxOf,
  exampleBinCode,
  findPlace,
  fitsWithin,
  generatedBinSize,
  hasAtMostDecimals,
  layoutStats,
  levelSpan,
  overlappingCode,
  shelfTransform,
} from "./selectors";

const fp = (x: number, y: number, width: number, length: number, rotation = 0) => ({
  x,
  y,
  width,
  length,
  rotation,
});

describe("hình học bản đồ (như BE Footprint)", () => {
  it("quay 90 / 270 đổi chỗ hai cạnh; (x, y) là góc trên-trái sau khi xoay", () => {
    expect(boxOf(fp(5, 5, 10, 1.2))).toEqual({ x: 5, y: 5, w: 10, h: 1.2 });
    expect(boxOf(fp(5, 5, 10, 1.2, 90))).toEqual({ x: 5, y: 5, w: 1.2, h: 10 });
    expect(boxOf(fp(5, 5, 10, 1.2, 180))).toEqual({ x: 5, y: 5, w: 10, h: 1.2 });
    expect(boxOf(fp(5, 5, 10, 1.2, 270))).toEqual({ x: 5, y: 5, w: 1.2, h: 10 });
  });

  it("BR-07: chạm cạnh KHÔNG chồng lấn, phủ một phần thì có", () => {
    const a = boxOf(fp(0, 0, 10, 2));
    expect(boxesOverlap(a, boxOf(fp(10, 0, 5, 2)))).toBe(false);
    expect(boxesOverlap(a, boxOf(fp(0, 2, 5, 2)))).toBe(false);
    expect(boxesOverlap(a, boxOf(fp(9.999, 1, 5, 2)))).toBe(true);
  });

  it("BR-06: chạm mép khung tính là bên trong", () => {
    expect(fitsWithin(boxOf(fp(50, 30, 10, 10)), 60, 40)).toBe(true);
    expect(fitsWithin(boxOf(fp(50.001, 30, 10, 10)), 60, 40)).toBe(false);
    expect(fitsWithin(boxOf(fp(55, 0, 10, 1, 90)), 60, 40)).toBe(true);
  });

  it("BR-07: chỉ kệ / khu vực KHÔNG INACTIVE mới chặn chỗ", () => {
    expect(overlappingCode(boxOf(fp(6, 5, 2, 1)), LAYOUT)).toBe("A01");
    expect(overlappingCode(boxOf(fp(20, 20, 2, 1)), LAYOUT)).toBe(null);
    // Kệ Z99 INACTIVE ở (30, 30) → chỗ đó coi như trống
    expect(overlappingCode(boxOf(fp(30, 30, 1, 1)), LAYOUT)).toBe(null);
  });

  it("phép đặt khung kệ lên mặt bằng giữ đúng hộp sau khi xoay", () => {
    expect(shelfTransform(fp(5, 5, 10, 1.2))).toEqual({ tx: 5, ty: 5, deg: 0 });
    expect(shelfTransform(fp(5, 5, 10, 1.2, 90))).toEqual({ tx: 6.2, ty: 5, deg: 90 });
    expect(shelfTransform(fp(5, 5, 10, 1.2, 180))).toEqual({ tx: 15, ty: 6.2, deg: 180 });
    expect(shelfTransform(fp(5, 5, 10, 1.2, 270))).toEqual({ tx: 5, ty: 15, deg: 270 });
  });
});

describe("số liệu dẫn xuất", () => {
  it("BR-14: kích thước bin làm tròn XUỐNG tới milimét", () => {
    expect(generatedBinSize(10, 1.2, 1, 3)).toEqual({ width: 3.333, length: 1.2 });
    expect(generatedBinSize(10, 1, 3, 4)).toEqual({ width: 2.5, length: 0.333 });
  });

  it("tầng thiếu số đo xếp đều theo chiều cao mặc định — chỉ để vẽ 3D", () => {
    expect(levelSpan({ levelIndex: 2, elevation: 1.5, usableHeight: 1.4 })).toEqual({
      bottom: 1.5,
      height: 1.4,
    });
    expect(levelSpan({ levelIndex: 3, elevation: null, usableHeight: null }).bottom).toBe(3);
  });

  it("đếm kệ, bin, bin dùng được (theo `usable` của BE), khu vực", () => {
    expect(layoutStats(LAYOUT)).toEqual({ shelves: 2, bins: 3, usableBins: 2, areas: 1 });
  });

  it("tìm kệ / khu vực theo id đang chọn", () => {
    expect(findPlace(LAYOUT, "shelf-a01")?.kind).toBe("shelf");
    expect(findPlace(LAYOUT, "area-rcv")?.kind).toBe("area");
    expect(findPlace(LAYOUT, "khong-co")).toBeNull();
    expect(findPlace(LAYOUT, null)).toBeNull();
  });

  it("BR-10: ví dụ mã bin mở đầu bằng prefix viết hoa", () => {
    expect(exampleBinCode("hcm")).toBe("HCM-A01-1-01");
    expect(exampleBinCode("")).toBe("PREFIX-A01-1-01");
  });

  it("đo lường tối đa 3 số lẻ (docs 06 §3)", () => {
    expect(hasAtMostDecimals(1.234, 3)).toBe(true);
    expect(hasAtMostDecimals(1.2345, 3)).toBe(false);
  });
});
