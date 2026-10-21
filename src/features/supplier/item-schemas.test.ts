import { describe, expect, it } from "vitest";

import { supplierItemFormSchema } from "./item-schemas";

const valid = {
  sku: "tee-001",
  supplierSkuCode: "",
  price: "12.34",
  moq: "10",
  packSize: "2",
  leadTimeDays: "",
  preferred: false,
};

function issues(over: Record<string, unknown>, currency: string | null = "USD") {
  const result = supplierItemFormSchema(currency).safeParse({ ...valid, ...over });
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

describe("supplierItemFormSchema — điều khoản danh mục (BE SupplierItemTerms, docs 02 §4 bước 5)", () => {
  it("hợp lệ: SKU được trim + in hoa", () => {
    const result = supplierItemFormSchema("USD").safeParse({ ...valid, sku: " tee-001 " });
    expect(result.success && result.data.sku).toBe("TEE-001");
  });

  it("moq 5, packSize 2 → lỗi ở moq", () => {
    expect(issues({ moq: "5", packSize: "2" })).toEqual(["moq"]);
  });

  it("VND: giá 1500.5 → lỗi; USD: 12.34 hợp lệ, 12.345 lỗi", () => {
    expect(issues({ price: "1500.5" }, "VND")).toEqual(["price"]);
    expect(issues({ price: "1500" }, "VND")).toEqual([]);
    expect(issues({ price: "12.34" }, "USD")).toEqual([]);
    expect(issues({ price: "12.345" }, "USD")).toEqual(["price"]);
  });

  it("chưa biết tiền tệ: 12.34 hợp lệ (BE quyết)", () => {
    expect(issues({ price: "12.34" }, null)).toEqual([]);
    expect(issues({ price: "12.345" }, null)).toEqual(["price"]);
  });

  it("giá gõ dấu phẩy thập phân (12,5) → hợp lệ như 12.5", () => {
    expect(issues({ price: "12,5" })).toEqual([]);
    expect(issues({ price: "1500,5" }, "VND")).toContain("price");
  });

  it("vượt giới hạn BE: giá > 16 chữ số phần nguyên, moq / quy cách > int32 → lỗi tại ô", () => {
    expect(issues({ price: "12345678901234567" })).toContain("price");
    expect(issues({ price: "9999999999999999.99" })).toEqual([]);
    expect(issues({ moq: "99999999999", packSize: "1" })).toContain("moq");
    expect(issues({ packSize: "2147483648" })).toContain("packSize");
  });

  it("giá phải > 0", () => {
    expect(issues({ price: "0" })).toEqual(["price"]);
    expect(issues({ price: "" })).toEqual(["price"]);
  });

  it("leadTimeDays rỗng hợp lệ, 366 lỗi", () => {
    expect(issues({ leadTimeDays: "" })).toEqual([]);
    expect(issues({ leadTimeDays: "0" })).toEqual([]);
    expect(issues({ leadTimeDays: "365" })).toEqual([]);
    expect(issues({ leadTimeDays: "366" })).toEqual(["leadTimeDays"]);
  });

  it("supplierSkuCode 51 ký tự → lỗi", () => {
    expect(issues({ supplierSkuCode: "a".repeat(50) })).toEqual([]);
    expect(issues({ supplierSkuCode: "a".repeat(51) })).toEqual(["supplierSkuCode"]);
  });

  it("moq / packSize phải là số nguyên ≥ 1; SKU sai mẫu bị chặn", () => {
    expect(issues({ moq: "0" })).toContain("moq");
    expect(issues({ packSize: "1.5" })).toContain("packSize");
    expect(issues({ sku: "-bad" })).toEqual(["sku"]);
    expect(issues({ sku: "" })).toEqual(["sku"]);
  });
});
