/**
 * Contract test: mock adapter nói đúng hợp đồng BE `ProductTaxonomyController` để `taxonomy-api.ts`
 * chạy y hệt trên mock và BE thật (PageResponse, mã in hoa, 409 trùng mã / slug, 404 cha, cây tối
 * đa 11 cấp, PUT thay toàn bộ, mã và cha bất biến).
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetTaxonomyMockStore } from "@/lib/api/mock-routes-taxonomy-store";

import { createProduct, listBrands, listCategories } from "./api";
import {
  createBrand,
  createCategory,
  listBrandPage,
  listCategoryPage,
  updateBrand,
  updateCategory,
} from "./taxonomy-api";

import type { BrandFormValues, CategoryFormValues } from "./taxonomy-input-schemas";

// Mỗi request mock có độ trễ giả lập; ca cây 11 cấp gửi ~13 request liên tiếp
vi.setConfig({ testTimeout: 60_000 });

beforeEach(() => {
  // Mock adapter có 5% lỗi ngẫu nhiên (random < 0.05) — cố định để test ổn định, độ trễ ngắn nhất
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetTaxonomyMockStore();
  activateMockAdapter();
});

afterAll(() => vi.restoreAllMocks());

async function apiError(p: Promise<unknown>) {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(ApiError);
  return e as ApiError;
}

const brand = (patch: Partial<BrandFormValues> = {}): BrandFormValues => ({
  code: "hanes",
  name: "Hanes",
  logoUrl: "",
  active: true,
  ...patch,
});

const category = (patch: Partial<CategoryFormValues> = {}): CategoryFormValues => ({
  code: "cups",
  parentId: "",
  name: "Ly cốc",
  sortOrder: "",
  imageUrl: "",
  seoTitle: "",
  seoDescription: "",
  active: true,
  ...patch,
});

describe("thương hiệu", () => {
  it("danh sách là PageResponse, lọc q / active, sắp theo name mặc định", async () => {
    const page = await listBrandPage({ page: 0, size: 20 });
    expect(page.items.map((b) => b.name)).toEqual(["Gildan", "StockFlow Basics"]);
    expect(page).toMatchObject({ page: 0, totalElements: 2, hasNext: false });
    expect((await listBrandPage({ q: "gil" })).items).toHaveLength(1);
    expect((await listBrandPage({ sort: "code,desc" })).items[0]?.code).toBe("SFB");
  });

  it("size > 200 hoặc sort ngoài whitelist → 400 UNSUPPORTED_PARAMETER", async () => {
    expect((await apiError(listBrandPage({ size: 201 }))).code).toBe("UNSUPPORTED_PARAMETER");
    expect((await apiError(listBrandPage({ sort: "slug,asc" }))).code).toBe(
      "UNSUPPORTED_PARAMETER",
    );
  });

  it("tạo: mã in hoa, slug từ mã; trùng mã hoặc trùng slug → 409", async () => {
    const created = await createBrand(brand({ code: " hanes_us " }));
    expect(created).toMatchObject({ code: "HANES_US", slug: "hanes-us", active: true });
    expect(created).not.toHaveProperty("logoUrl");
    expect((await apiError(createBrand(brand({ code: "HANES_US" })))).code).toBe(
      "BRAND_CODE_ALREADY_EXISTS",
    );
    // `A_B` và `A-B` cùng slug `a-b`
    expect((await apiError(createBrand(brand({ code: "hanes-us" })))).code).toBe(
      "BRAND_CODE_ALREADY_EXISTS",
    );
  });

  // Ngưng dùng: lookup của form SP vẫn có (cờ active=false) để tra tên SP cũ — ô chọn tự ẩn nó
  // (ProductMasterSelects, test ở ProductCreate.edit.test).
  it("sửa thay toàn bộ: bỏ logo = xoá, ngưng dùng thì lookup đánh dấu active=false", async () => {
    const created = await createBrand(brand({ logoUrl: "https://cdn.example/hanes.png" }));
    expect(created.logoUrl).toBe("https://cdn.example/hanes.png");
    const updated = await updateBrand({
      brandId: created.brandId,
      values: brand({ code: "IGNORED", name: "Hanes VN", logoUrl: "", active: false }),
    });
    expect(updated).toMatchObject({ code: "HANES", name: "Hanes VN", active: false });
    expect(updated).not.toHaveProperty("logoUrl");
    expect((await listBrands()).find((b) => b.brandId === created.brandId)).toMatchObject({
      active: false,
    });
  });

  it("sửa thương hiệu không tồn tại → 404 BRAND_NOT_FOUND", async () => {
    expect((await apiError(updateBrand({ brandId: "nope", values: brand() }))).code).toBe(
      "BRAND_NOT_FOUND",
    );
  });
});

describe("danh mục", () => {
  it("mặc định mọi danh mục theo path (thứ tự cây); roots / parentId lọc đúng", async () => {
    const all = await listCategoryPage({ size: 200 });
    const paths = all.items.map((c) => c.path);
    expect(paths).toEqual([...paths].sort());
    expect(all.items[0]).toMatchObject({ depth: 0 });
    expect(all.items[0]).not.toHaveProperty("parentId");
    const roots = await listCategoryPage({ roots: true });
    expect(roots.items.every((c) => c.depth === 0)).toBe(true);
    const children = await listCategoryPage({ parentId: "CAT-01" });
    expect(children.items.every((c) => c.parentId === "CAT-01")).toBe(true);
    expect(children.totalElements).toBeGreaterThan(0);
  });

  it("tạo gốc rồi con: path / depth tính từ cha, con xuất hiện ngay dưới cha", async () => {
    const root = await createCategory(category({ sortOrder: "3" }));
    expect(root).toMatchObject({ code: "CUPS", path: "/CUPS", depth: 0, sortOrder: 3 });
    const child = await createCategory(category({ code: "paper", parentId: root.categoryId }));
    expect(child).toMatchObject({ parentId: root.categoryId, path: "/CUPS/PAPER", depth: 1 });
    const paths = (await listCategoryPage({ size: 200 })).items.map((c) => c.path);
    expect(paths.indexOf("/CUPS/PAPER")).toBe(paths.indexOf("/CUPS") + 1);
  });

  it("cha không tồn tại → 404; cha ở cấp 11 → 400 VALIDATION_FAILED", async () => {
    expect((await apiError(createCategory(category({ parentId: "nope" })))).code).toBe(
      "CATEGORY_NOT_FOUND",
    );
    let parentId = "";
    for (let depth = 0; depth <= 10; depth += 1) {
      parentId = (await createCategory(category({ code: `L${depth}`, parentId }))).categoryId;
    }
    const error = await apiError(createCategory(category({ code: "L11", parentId })));
    expect(error).toMatchObject({ status: 400, code: "VALIDATION_FAILED" });
    expect(error.message).toMatch(/11 levels deep/);
  });

  it("sửa thay toàn bộ, mã / cha giữ nguyên; trùng mã khi tạo → 409", async () => {
    const created = await createCategory(category({ seoTitle: "Ly cốc giá tốt" }));
    const updated = await updateCategory({
      categoryId: created.categoryId,
      values: category({ name: "Ly", seoTitle: "", active: false }),
    });
    expect(updated).toMatchObject({ code: "CUPS", path: "/CUPS", name: "Ly", active: false });
    expect(updated).not.toHaveProperty("seoTitle");
    expect((await apiError(createCategory(category()))).code).toBe("CATEGORY_CODE_ALREADY_EXISTS");
  });
});

describe("liên kết với sản phẩm", () => {
  it("tạo SP với thương hiệu / danh mục vừa thêm trên màn quản lý", async () => {
    const newBrand = await createBrand(brand());
    const newCategory = await createCategory(category());
    expect(
      (await listCategories()).items.some((c) => c.categoryId === newCategory.categoryId),
    ).toBe(true);
    const product = await createProduct({
      code: `TAXO-${Date.now()}`,
      name: "Ly giấy",
      nameEn: "Paper cup",
      categoryId: newCategory.categoryId,
      brandId: newBrand.brandId,
      description: "",
      descriptionEn: "",
      taxClass: "STANDARD",
      kind: "STANDARD",
    });
    expect(product).toMatchObject({ brandId: newBrand.brandId, brand: "Hanes" });
  });
});
