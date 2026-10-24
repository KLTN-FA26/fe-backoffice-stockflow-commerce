import { describe, expect, it } from "vitest";

import { VEHICLE_TYPE_FIELD_MESSAGES as MSG } from "@/constants";

import { vehicleTypeFormSchema } from "./input-schemas";

import type { VehicleTypeFormInput } from "./types";

const valid: VehicleTypeFormInput = {
  code: "truck-3t",
  name: " Xe tải 3 tấn ",
  kind: "TRUCK",
  innerLengthMm: "4200",
  innerWidthMm: "1900",
  innerHeightMm: "1900",
  gussetMm: "50",
  doorWidthMm: "",
  doorHeightMm: "",
  maxPayloadKg: "3000",
  availableCount: "2",
  rentalPrice: "",
  status: "ACTIVE",
};

/** Lỗi đầu tiên của từng trường khi đổi `overrides`. */
function issues(overrides: Partial<VehicleTypeFormInput>) {
  const result = vehicleTypeFormSchema.safeParse({ ...valid, ...overrides });
  if (result.success) return {};
  const byField: Record<string, string> = {};
  for (const issue of result.error.issues) byField[String(issue.path[0])] ??= issue.message;
  return byField;
}

describe("vehicleTypeFormSchema — phản chiếu VehicleTypeRequest của BE", () => {
  it("hợp lệ: cắt khoảng trắng, đổi chuỗi sang số, giá thuê trống → undefined", () => {
    const result = vehicleTypeFormSchema.parse(valid);
    expect(result).toMatchObject({
      name: "Xe tải 3 tấn",
      innerLengthMm: 4200,
      gussetMm: 50,
      maxPayloadKg: 3000,
      availableCount: 2,
    });
    expect(result.rentalPrice).toBeUndefined();
  });

  it("khe góc trống = 0 (BE: PUT thay thế toàn bộ, khe góc vắng = 0) — form luôn gửi số", () => {
    expect(vehicleTypeFormSchema.parse({ ...valid, gussetMm: "" }).gussetMm).toBe(0);
  });

  it("khe góc phải vừa thùng: 2 × khe góc < rộng trong và khe góc < cao trong", () => {
    // Rộng 1900: 950 × 2 = 1900 không nhỏ hơn rộng; 949 thì được
    expect(issues({ gussetMm: "950" }).gussetMm).toBe(MSG.gussetTooLargeForBox);
    expect(issues({ gussetMm: "949" }).gussetMm).toBeUndefined();
    // Cao 500: khe góc 500 không nhỏ hơn cao
    expect(issues({ innerHeightMm: "500", gussetMm: "500" }).gussetMm).toBe(
      MSG.gussetTooLargeForBox,
    );
    expect(issues({ innerHeightMm: "500", gussetMm: "499" }).gussetMm).toBeUndefined();
    // Số nhập chưa hợp lệ: chỉ báo lỗi của chính ô đó, không thêm lỗi vừa thùng
    expect(issues({ innerWidthMm: "0", gussetMm: "10" }).gussetMm).toBeUndefined();
    expect(issues({ gussetMm: "1001" }).gussetMm).toBe(MSG.gussetTooLarge);
  });

  it("cửa trống = null (không giới hạn cửa) — form luôn gửi cả hai ô", () => {
    const result = vehicleTypeFormSchema.parse(valid);
    expect(result.doorWidthMm).toBeNull();
    expect(result.doorHeightMm).toBeNull();
    expect(vehicleTypeFormSchema.parse({ ...valid, doorWidthMm: "   " }).doorWidthMm).toBeNull();
  });

  it("cửa có số: đổi sang số; mỗi phía đặt riêng được", () => {
    expect(
      vehicleTypeFormSchema.parse({ ...valid, doorWidthMm: " 1800 ", doorHeightMm: "1900" }),
    ).toMatchObject({ doorWidthMm: 1800, doorHeightMm: 1900 });
    const one = vehicleTypeFormSchema.parse({ ...valid, doorHeightMm: "1500" });
    expect(one.doorWidthMm).toBeNull();
    expect(one.doorHeightMm).toBe(1500);
  });

  it("cửa phải là số nguyên trong 1..30.000 mm", () => {
    expect(issues({ doorWidthMm: "0" }).doorWidthMm).toBe(MSG.doorInvalid);
    expect(issues({ doorWidthMm: "-5" }).doorWidthMm).toBe(MSG.doorInvalid);
    expect(issues({ doorHeightMm: "30001" }).doorHeightMm).toBe(MSG.doorInvalid);
    expect(issues({ doorWidthMm: "12.5" }).doorWidthMm).toBe(MSG.integerRequired);
    expect(issues({ doorHeightMm: "abc" }).doorHeightMm).toBe(MSG.integerRequired);
    expect(issues({ doorWidthMm: "1" }).doorWidthMm).toBeUndefined();
  });

  it("cửa không lớn hơn thùng: rộng cửa ≤ rộng trong, cao cửa ≤ cao trong (bằng thì được)", () => {
    // Thùng 1900 × 1900
    expect(issues({ doorWidthMm: "1901" }).doorWidthMm).toBe(MSG.doorTooLargeForWidth);
    expect(issues({ doorWidthMm: "1900" }).doorWidthMm).toBeUndefined();
    expect(issues({ doorHeightMm: "1901" }).doorHeightMm).toBe(MSG.doorTooLargeForHeight);
    expect(issues({ doorHeightMm: "1900" }).doorHeightMm).toBeUndefined();
    // Rộng cửa so với rộng, không so với cao (và ngược lại)
    expect(issues({ innerHeightMm: "1000", doorWidthMm: "1500" }).doorWidthMm).toBeUndefined();
    expect(issues({ innerWidthMm: "1000", doorHeightMm: "1500" }).doorHeightMm).toBeUndefined();
    expect(issues({ innerWidthMm: "1000", doorWidthMm: "1500" }).doorWidthMm).toBe(
      MSG.doorTooLargeForWidth,
    );
  });

  it("số nhập chưa hợp lệ: chỉ báo lỗi của chính ô đó, không thêm lỗi vừa thùng", () => {
    expect(issues({ doorWidthMm: "30001" }).doorWidthMm).toBe(MSG.doorInvalid);
    expect(issues({ innerWidthMm: "0", doorWidthMm: "10" }).doorWidthMm).toBeUndefined();
    expect(issues({ innerHeightMm: "", doorHeightMm: "10" }).doorHeightMm).toBeUndefined();
  });

  it("kích thước phải > 0 và ≤ 30.000 mm, số nguyên", () => {
    expect(issues({ innerLengthMm: "0" }).innerLengthMm).toBe(MSG.dimensionPositive);
    expect(issues({ innerWidthMm: "-5" }).innerWidthMm).toBe(MSG.dimensionPositive);
    expect(issues({ innerHeightMm: "30001" }).innerHeightMm).toBe(MSG.dimensionTooLarge);
    expect(issues({ innerLengthMm: "" }).innerLengthMm).toBe(MSG.numberRequired);
    expect(issues({ innerLengthMm: "12.5" }).innerLengthMm).toBe(MSG.integerRequired);
    expect(issues({ innerLengthMm: "30000" }).innerLengthMm).toBeUndefined();
  });

  it("tải trọng > 0, ≤ 100.000 kg, tối đa 3 số lẻ; nhận dấu phẩy thập phân", () => {
    expect(issues({ maxPayloadKg: "0" }).maxPayloadKg).toBe(MSG.payloadPositive);
    expect(issues({ maxPayloadKg: "-1" }).maxPayloadKg).toBe(MSG.payloadPositive);
    expect(issues({ maxPayloadKg: "100001" }).maxPayloadKg).toBe(MSG.payloadTooLarge);
    expect(issues({ maxPayloadKg: "10.1234" }).maxPayloadKg).toBe(MSG.payloadFraction);
    expect(issues({ maxPayloadKg: "" }).maxPayloadKg).toBe(MSG.numberRequired);
    expect(vehicleTypeFormSchema.parse({ ...valid, maxPayloadKg: "1250,5" }).maxPayloadKg).toBe(
      1250.5,
    );
  });

  it("số xe ≥ 0 và ≤ 10.000; 0 hợp lệ", () => {
    expect(issues({ availableCount: "-1" }).availableCount).toBe(MSG.countNegative);
    expect(issues({ availableCount: "10001" }).availableCount).toBe(MSG.countTooLarge);
    expect(issues({ availableCount: "0" }).availableCount).toBeUndefined();
  });

  it("khe góc ≥ 0 và ≤ 1.000 mm", () => {
    expect(issues({ gussetMm: "-1" }).gussetMm).toBe(MSG.gussetNegative);
    expect(issues({ gussetMm: "1001" }).gussetMm).toBe(MSG.gussetTooLarge);
    expect(issues({ gussetMm: "0" }).gussetMm).toBeUndefined();
  });

  it("giá thuê (tuỳ chọn) ≥ 0, tối đa 4 số lẻ", () => {
    expect(issues({ rentalPrice: "-1" }).rentalPrice).toBe(MSG.priceNegative);
    expect(issues({ rentalPrice: "1.23456" }).rentalPrice).toBe(MSG.priceDigits);
    expect(vehicleTypeFormSchema.parse({ ...valid, rentalPrice: "1500000" }).rentalPrice).toBe(
      1500000,
    );
  });

  it("mã 2–32 ký tự chữ / số / '-' / '_', bắt đầu bằng chữ hoặc số (không phân biệt hoa thường)", () => {
    expect(issues({ code: "" }).code).toBe(MSG.codeRequired);
    expect(issues({ code: "A" }).code).toBe(MSG.codePattern);
    expect(issues({ code: "-AB" }).code).toBe(MSG.codePattern);
    expect(issues({ code: "AB CD" }).code).toBe(MSG.codePattern);
    expect(issues({ code: "A".repeat(33) }).code).toBe(MSG.codePattern);
    expect(issues({ code: "TRUCK-3T" }).code).toBeUndefined();
    expect(issues({ code: "truck_3t" }).code).toBeUndefined();
  });

  it("tên bắt buộc, tối đa 120 ký tự", () => {
    expect(issues({ name: "   " }).name).toBe(MSG.nameRequired);
    expect(issues({ name: "x".repeat(121) }).name).toBe(MSG.nameTooLong);
  });

  it("kind và status chỉ nhận giá trị của BE", () => {
    expect(issues({ kind: "BOAT" as never }).kind).toBeDefined();
    expect(issues({ status: "DELETED" as never }).status).toBeDefined();
  });
});
