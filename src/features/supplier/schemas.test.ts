import { describe, expect, it } from "vitest";

import { foreignSupplier, validFormValues } from "./__fixtures__/supplier";
import { isValidApiEndpoint, supplierApiDtoSchema, supplierFormSchema } from "./schemas";
import { supplierToFormValues } from "./selectors";

function errorsOf(values: unknown): Record<string, string> {
  const result = supplierFormSchema.safeParse(values);
  if (result.success) return {};
  // Giữ lỗi ĐẦU TIÊN của mỗi ô — giống react-hook-form hiển thị
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) out[issue.path.join(".")] ??= issue.message;
  return out;
}

describe("supplierFormSchema — ràng buộc BE SaveSupplierRequest (PR #36)", () => {
  it("dữ liệu hợp lệ thì pass", () => {
    expect(errorsOf(validFormValues)).toEqual({});
  });

  it("mã NCC bắt buộc và chỉ gồm chữ/số/._- (BE không tự sinh mã)", () => {
    expect(errorsOf({ ...validFormValues, code: "" }).code).toBe(
      "Mã nhà cung cấp không được để trống",
    );
    expect(errorsOf({ ...validFormValues, code: "SUP 01" }).code).toMatch(/chữ, số/);
  });

  it("nhận MST nước ngoài chữ-số (NCC Guangzhou lưu được)", () => {
    expect(errorsOf(supplierToFormValues(foreignSupplier))).toEqual({});
  });

  it("MST sai định dạng thì báo lỗi tiếng Việt; để trống thì hợp lệ", () => {
    expect(errorsOf({ ...validFormValues, taxCode: "123" }).taxCode).toMatch(/8–32 ký tự/);
    expect(errorsOf({ ...validFormValues, taxCode: "" })).toEqual({});
  });

  it("số điện thoại phải có 8–15 chữ số", () => {
    expect(errorsOf({ ...validFormValues, phone: "0901 23" }).phone).toBe(
      "Số điện thoại phải có 8–15 chữ số",
    );
    expect(errorsOf({ ...validFormValues, phone: "+86 20 1234 5678" })).toEqual({});
  });

  it("thời hạn thanh toán / giao hàng là số nguyên 0–365", () => {
    expect(errorsOf({ ...validFormValues, paymentTermDays: 366 }).paymentTermDays).toMatch(/365/);
    expect(errorsOf({ ...validFormValues, leadTimeDays: -1 }).leadTimeDays).toMatch(/âm/);
    expect(errorsOf({ ...validFormValues, leadTimeDays: Number.NaN }).leadTimeDays).toMatch(/số/);
  });

  it("deliveryContactValid: kênh EMAIL thiếu email → lỗi ở ô email", () => {
    expect(errorsOf({ ...validFormValues, email: "" }).email).toBe(
      "Kênh Email cần có email liên hệ",
    );
  });

  it("deliveryContactValid: kênh API cần endpoint https → lỗi ở ô apiEndpoint", () => {
    const api = { ...validFormValues, communicationChannel: "API" as const, email: "" };
    expect(errorsOf({ ...api, apiEndpoint: "http://ncc.vn/po" }).apiEndpoint).toMatch(/https/);
    expect(errorsOf({ ...api, apiEndpoint: "https://ncc.vn/po" })).toEqual({});
  });
});

describe("isValidApiEndpoint", () => {
  it.each([
    ["https://api.ncc.vn/po", true],
    ["https://api.ncc.vn:443/po", true],
    ["http://api.ncc.vn/po", false],
    ["https://api.ncc.vn/po?x=1", false],
    ["https://api.ncc.vn/po#a", false],
    ["https://user:pw@api.ncc.vn/po", false],
    ["https://api.ncc.vn:8443/po", false],
    ["không phải url", false],
  ])("%s → %s", (url, ok) => {
    expect(isValidApiEndpoint(url)).toBe(ok);
  });
});

describe("supplierApiDtoSchema", () => {
  it("không nhận status hiển thị (Active) — BE trả ACTIVE/INACTIVE", () => {
    const result = supplierApiDtoSchema.safeParse({ ...foreignSupplier, status: "Active" });
    expect(result.success).toBe(false);
  });
});
