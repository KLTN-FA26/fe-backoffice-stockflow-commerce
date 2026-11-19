import { describe, expect, it } from "vitest";

import { AREA_TYPE_LABELS, AREA_TYPES as CONSTANT_AREA_TYPES } from "@/constants";

import { AREA_TYPES } from "./warehouse-layout";

/**
 * BE `AreaType` (warehouse/internal/domain/AreaType.java): khu QC đã gộp vào QUARANTINE, khu đóng gói PACKING gộp
 * vào DISPATCH (kltn-docs 06 BR-22; 20 §4.8). FE giữ đúng danh sách này ở MỘT chỗ — bản sao riêng từng làm lệch
 * (STAGING có ở đây mà thiếu ở constants, bản đồ kho parse lỗi).
 */
const BE_AREA_TYPES = [
  "RECEIVING",
  "QUARANTINE",
  "DISPATCH",
  "STAGING",
  "OVERFLOW",
  "PRODUCTION",
  "NON_STORAGE",
];

describe("AREA_TYPES khớp BE AreaType", () => {
  it("đúng các loại khu BE có — không còn QUALITY_CONTROL / PACKING", () => {
    expect([...CONSTANT_AREA_TYPES].sort()).toEqual([...BE_AREA_TYPES].sort());
  });

  it("tham chiếu khu vực dùng chung danh sách của constants, không giữ bản sao", () => {
    expect(AREA_TYPES).toBe(CONSTANT_AREA_TYPES);
  });

  it("mỗi loại khu có nhãn, không thừa nhãn của loại đã bỏ", () => {
    expect(Object.keys(AREA_TYPE_LABELS).sort()).toEqual([...BE_AREA_TYPES].sort());
  });
});
