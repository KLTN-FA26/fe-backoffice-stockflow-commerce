import { describe, expect, it } from "vitest";

import {
  beUomConversionSchema,
  cartonFormValuesOf,
  cartonMeasured,
  cartonOf,
  cartonSpecFormSchema,
  cartonUnitBody,
  cartonVolumeM3,
} from "./carton-schemas";

import type { UomConversion } from "./carton-schemas";

const unit = (over: Partial<UomConversion> = {}): UomConversion =>
  beUomConversionSchema.parse({
    id: "u",
    sku: "CUP",
    unitOfMeasure: "CARTON",
    factor: 50,
    base: false,
    defaultPurchase: false,
    active: true,
    version: 0,
    defaultShipping: false,
    ...over,
  });
const BASE = unit({ id: "b", unitOfMeasure: "EACH", factor: 1, base: true });

describe("BE UomConversionResponse", () => {
  it("nhận BigDecimal dạng số hoặc chuỗi; thiếu cỡ / khối lượng (BE non_null) là undefined", () => {
    const parsed = unit({ weightKg: undefined, lengthCm: undefined });
    expect(parsed.weightKg).toBeUndefined();
    expect(
      beUomConversionSchema.parse({ ...parsed, weightKg: "10.500", lengthCm: 40 }),
    ).toMatchObject({ weightKg: 10.5, lengthCm: 40 });
  });
});

// BE `UomConversion.cartonOf` (kltn-docs 01 BR-03, BR-11)
describe("cartonOf", () => {
  it("một đơn vị đóng gói còn dùng, hơn một cái → là thùng", () => {
    const carton = unit();
    expect(cartonOf([BASE, carton])).toEqual({ kind: "carton", carton });
  });

  it("đơn vị cơ sở, đơn vị đã ngừng, đơn vị 1 cái không phải thùng", () => {
    expect(cartonOf([BASE])).toEqual({ kind: "none" });
    expect(cartonOf([BASE, unit({ active: false }), unit({ id: "x", factor: 1 })])).toEqual({
      kind: "none",
    });
  });

  it("nhiều ứng viên → chọn đơn vị giao mặc định; không có / nhiều hơn một → không đoán", () => {
    const box = unit({ id: "box", unitOfMeasure: "BOX", factor: 10 });
    const carton = unit({ defaultShipping: true });
    expect(cartonOf([BASE, box, carton])).toEqual({ kind: "carton", carton });
    expect(cartonOf([BASE, box, unit()])).toEqual({
      kind: "ambiguous",
      candidates: [box, unit()],
    });
  });
});

describe("số đo của thùng", () => {
  it("đủ D×R×C + khối lượng thùng đầy mới in được nhãn (BE CartonSpec.measured)", () => {
    const full = unit({ lengthCm: 40, widthCm: 30, heightCm: 25, weightKg: 10 });
    expect(cartonMeasured(full)).toBe(true);
    expect(cartonMeasured({ ...full, weightKg: undefined })).toBe(false);
    expect(cartonVolumeM3(full)).toBeCloseTo(0.03);
    expect(cartonVolumeM3({ ...full, heightCm: null })).toBeNull();
  });
});

describe("form thùng", () => {
  const ok = cartonFormValuesOf(null);
  const valid = { ...ok, unitsPerCarton: "1000" };

  it("mặc định CARTON, là đơn vị giao mặc định; số cái / thùng bắt buộc ≥ 2", () => {
    expect(ok).toMatchObject({
      unitOfMeasure: "CARTON",
      defaultShipping: true,
      unitsPerCarton: "",
    });
    expect(cartonSpecFormSchema.safeParse(valid).success).toBe(true);
    for (const bad of ["", "1", "0", "2.5", "-3", "1e3", "abc"]) {
      expect(cartonSpecFormSchema.safeParse({ ...valid, unitsPerCarton: bad }).success).toBe(false);
    }
  });

  it("mã đơn vị theo BE @Pattern [A-Z0-9_]{1,16}", () => {
    for (const bad of ["", "carton", "THÙNG", "A".repeat(17), "CT-1"]) {
      expect(cartonSpecFormSchema.safeParse({ ...valid, unitOfMeasure: bad }).success).toBe(false);
    }
  });

  it("cỡ: số dương ≤ 2 chữ số lẻ, ≤ 8 chữ số nguyên; khối lượng ≤ 3 chữ số lẻ; trống được", () => {
    const parse = (field: string, value: string) =>
      cartonSpecFormSchema.safeParse({ ...valid, [field]: value }).success;
    expect(parse("lengthCm", "")).toBe(true);
    expect(parse("lengthCm", "40.25")).toBe(true);
    expect(parse("lengthCm", "12345678")).toBe(true);
    for (const bad of ["0", "-1", "40.255", "123456789", "40,5", "1e2"]) {
      expect(parse("lengthCm", bad)).toBe(false);
    }
    expect(parse("weightKg", "10.125")).toBe(true);
    expect(parse("weightKg", "10.1255")).toBe(false);
    expect(parse("weightKg", "12345678")).toBe(false);
  });

  it("thùng đang có → giá trị form; body gửi số, ô trống thành null", () => {
    const carton = unit({ factor: 60, lengthCm: 40, weightKg: 10.5, defaultShipping: false });
    const values = cartonFormValuesOf(carton);
    expect(values).toMatchObject({
      unitsPerCarton: "60",
      lengthCm: "40",
      widthCm: "",
      weightKg: "10.5",
    });
    expect(cartonUnitBody({ ...values, lengthCm: "040.50" })).toEqual({
      unitOfMeasure: "CARTON",
      factor: 60,
      lengthCm: 40.5,
      widthCm: null,
      heightCm: null,
      weightKg: 10.5,
      defaultShipping: false,
    });
  });
});
