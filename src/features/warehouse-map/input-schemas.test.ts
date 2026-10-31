import { describe, expect, it } from "vitest";

import { EMPTY_WAREHOUSE_FORM, warehouseCreateSchema, zoneCreateSchema } from "./input-schemas";

const messages = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  (result.error?.issues ?? []).map((issue) => issue.path.join("."));

const warehouse = (overrides: Partial<typeof EMPTY_WAREHOUSE_FORM> = {}) => ({
  ...EMPTY_WAREHOUSE_FORM,
  prefix: "hn",
  name: "Kho Hà Nội",
  street: "Lô CN2, KCN Bắc Thăng Long",
  provinceCode: "1",
  provinceName: "Thành phố Hà Nội",
  wardName: "Phường Ba Đình",
  mapWidth: "60",
  mapHeight: "40,5",
  ...overrides,
});

describe("khai báo kho (RegisterWarehouseRequest)", () => {
  it("hợp lệ: prefix tự viết hoa, dấu phẩy thập phân, địa chỉ hoàn hàng trống → null", () => {
    const out = warehouseCreateSchema.parse(warehouse());
    expect(out).toMatchObject({ prefix: "HN", mapWidth: 60, mapHeight: 40.5, returnAddress: null });
  });

  it("địa chỉ ghép một dòng: số nhà đường, phường / xã, tỉnh / thành — chỉ gửi `address`", () => {
    const out = warehouseCreateSchema.parse(warehouse());
    expect(out.address).toBe("Lô CN2, KCN Bắc Thăng Long, Phường Ba Đình, Thành phố Hà Nội");
    expect(out).not.toHaveProperty("provinceCode");
    expect(out).not.toHaveProperty("street");
  });

  it("thiếu tỉnh / phường / số nhà bị chặn; chuỗi ghép > 500 ký tự bị chặn (RegisterWarehouseRequest)", () => {
    expect(messages(warehouseCreateSchema.safeParse(warehouse({ provinceName: "" })))).toContain(
      "provinceName",
    );
    expect(messages(warehouseCreateSchema.safeParse(warehouse({ wardName: "" })))).toContain(
      "wardName",
    );
    expect(
      messages(warehouseCreateSchema.safeParse(warehouse({ street: "x".repeat(480) }))),
    ).toContain("street");
  });

  it("BR-10: prefix chỉ A–Z0–9, ≤ 10 ký tự, không có '-'", () => {
    for (const prefix of ["HN-1", "HÀNỘI", "ABCDEFGHIJK", ""]) {
      expect(messages(warehouseCreateSchema.safeParse(warehouse({ prefix })))).toContain("prefix");
    }
  });

  it("khung bản đồ > 0 và tối đa 3 số lẻ (không làm tròn)", () => {
    expect(messages(warehouseCreateSchema.safeParse(warehouse({ mapWidth: "0" })))).toContain(
      "mapWidth",
    );
    expect(messages(warehouseCreateSchema.safeParse(warehouse({ mapHeight: "1.2345" })))).toContain(
      "mapHeight",
    );
  });
});

describe("zone", () => {
  it("tên trùng (không phân biệt hoa thường) và màu sai định dạng bị chặn", () => {
    const schema = zoneCreateSchema(["Khu A - Sofa"]);
    expect(messages(schema.safeParse({ name: "khu a - sofa", color: "" }))).toContain("name");
    expect(messages(schema.safeParse({ name: "Khu C", color: "blue" }))).toContain("color");
    expect(schema.parse({ name: "Khu C", color: "" })).toEqual({ name: "Khu C", color: null });
  });
});
