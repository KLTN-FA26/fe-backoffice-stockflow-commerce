import { describe, expect, it } from "vitest";

import {
  makeBrandFormSchema,
  makeCategoryFormSchema,
  toBrandCreateRequest,
  toBrandUpdateRequest,
  toCategoryCreateRequest,
  toCategoryUpdateRequest,
} from "./taxonomy-input-schemas";
import { parentCodeOf } from "./taxonomy-schemas";

import type { BrandFormValues, CategoryFormValues } from "./taxonomy-input-schemas";

const brand = (patch: Partial<BrandFormValues> = {}): BrandFormValues => ({
  code: "gildan",
  name: "Gildan",
  logoUrl: "",
  active: true,
  ...patch,
});

const category = (patch: Partial<CategoryFormValues> = {}): CategoryFormValues => ({
  code: "ao-thun",
  parentId: "",
  name: "Áo thun",
  sortOrder: "",
  imageUrl: "",
  seoTitle: "",
  seoDescription: "",
  active: true,
  ...patch,
});

const codeOk = (code: string) => makeBrandFormSchema("create").safeParse(brand({ code })).success;

describe("mã thương hiệu / danh mục (@Pattern + CHECK ck_*_code)", () => {
  it("nhận chữ, số, '_' và '-' sau khi trim + in hoa", () => {
    expect(codeOk("  gildan-us_2 ")).toBe(true);
    expect(codeOk("A")).toBe(true);
    expect(codeOk("A".repeat(50))).toBe(true);
  });

  it("chặn ký tự đầu là '-' / '_', ký tự lạ, rỗng và > 50 ký tự", () => {
    expect(codeOk("-GILDAN")).toBe(false);
    expect(codeOk("_GILDAN")).toBe(false);
    expect(codeOk("GIL DAN")).toBe(false);
    expect(codeOk("ÁO")).toBe(false);
    expect(codeOk("")).toBe(false);
    expect(codeOk("A".repeat(51))).toBe(false);
  });

  it("khi sửa không kiểm mã (bất biến, không gửi lên)", () => {
    expect(makeBrandFormSchema("edit").safeParse(brand({ code: "legacy code" })).success).toBe(
      true,
    );
  });
});

describe("tên, thứ tự, SEO", () => {
  it("tên bắt buộc, tối đa 255 ký tự", () => {
    const schema = makeCategoryFormSchema("create");
    expect(schema.safeParse(category({ name: "   " })).success).toBe(false);
    expect(schema.safeParse(category({ name: "x".repeat(256) })).success).toBe(false);
    expect(schema.safeParse(category({ name: "x".repeat(255) })).success).toBe(true);
  });

  it("thứ tự là số nguyên (rỗng được — BE coi là 0)", () => {
    const schema = makeCategoryFormSchema("create");
    expect(schema.safeParse(category({ sortOrder: "" })).success).toBe(true);
    expect(schema.safeParse(category({ sortOrder: "-3" })).success).toBe(true);
    expect(schema.safeParse(category({ sortOrder: "1.5" })).success).toBe(false);
    expect(schema.safeParse(category({ sortOrder: "abc" })).success).toBe(false);
    expect(schema.safeParse(category({ sortOrder: "99999999999" })).success).toBe(false);
  });

  it("tiêu đề SEO tối đa 255 ký tự", () => {
    const schema = makeCategoryFormSchema("edit");
    expect(schema.safeParse(category({ seoTitle: "x".repeat(256) })).success).toBe(false);
  });
});

describe("request gửi BE", () => {
  it("tạo thương hiệu: mã chuẩn hoá, logo trống thì bỏ", () => {
    expect(toBrandCreateRequest(brand({ code: " gildan ", name: " Gildan " }))).toEqual({
      code: "GILDAN",
      name: "Gildan",
      logoUrl: undefined,
    });
  });

  it("sửa thương hiệu: luôn đủ field (PUT thay toàn bộ), không gửi mã", () => {
    const request = toBrandUpdateRequest(brand({ logoUrl: "", active: false }));
    expect(request).toEqual({ name: "Gildan", logoUrl: undefined, active: false });
    expect(Object.keys(request).sort()).toEqual(["active", "logoUrl", "name"]);
  });

  it("tạo danh mục: cha trống = gốc, thứ tự thành số", () => {
    expect(toCategoryCreateRequest(category({ parentId: "", sortOrder: "2" }))).toMatchObject({
      code: "AO-THUN",
      parentId: undefined,
      sortOrder: 2,
    });
    expect(toCategoryCreateRequest(category({ parentId: "c-1" })).parentId).toBe("c-1");
  });

  it("sửa danh mục: không gửi mã / cha, ô trống thành null để xoá giá trị cũ", () => {
    const request = toCategoryUpdateRequest(
      category({ seoTitle: "  ", imageUrl: " https://cdn/x.png ", active: false }),
    );
    expect(request).toEqual({
      name: "Áo thun",
      sortOrder: undefined,
      imageUrl: "https://cdn/x.png",
      seoTitle: undefined,
      seoDescription: undefined,
      active: false,
    });
  });
});

describe("parentCodeOf", () => {
  it("lấy mã cha từ path, gốc không có cha", () => {
    expect(parentCodeOf({ path: "/APPAREL" })).toBeNull();
    expect(parentCodeOf({ path: "/APPAREL/TSHIRT" })).toBe("APPAREL");
    expect(parentCodeOf({ path: "/A/B/C" })).toBe("B");
  });
});
