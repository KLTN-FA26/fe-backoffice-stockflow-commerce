/**
 * Mock routes — thương hiệu / danh mục (BE `ProductTaxonomyController` + `ProductTaxonomyService`).
 * Đúng hình `BrandResponse` / `CategoryResponse` (field null bị bỏ — `non_null`) và các luật: mã
 * `@Pattern` trên chuỗi thô rồi in hoa, trùng mã / slug 409, cha không tồn tại 404, cây tối đa
 * 11 cấp, PUT thay toàn bộ, mã và cha bất biến, không có DELETE.
 */
import { paginatePage, registerMockRoute } from "./mock-adapter";
import { bodyOf, fail, ok, pathParams, queryOf, text } from "./mock-route-utils";
import {
  brandStore,
  categoryStore,
  findMockBrand,
  findMockCategory,
  slugOf,
} from "./mock-routes-taxonomy-store";

import type { AxiosRequestConfig } from "axios";
import type { MockBrand, MockCategory } from "./mock-routes-taxonomy-store";

const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/;
const BRAND_SORT = ["name", "code", "createdAt"];
const CATEGORY_SORT = ["path", "name", "code", "sortOrder", "createdAt"];
const MAX_PARENT_DEPTH = 9;

const invalid = (field: string, message: string, code = "NotBlank") =>
  fail(400, "VALIDATION_FAILED", "Invalid request data", [{ field, message, code }]);
const brandNotFound = (id: string) => fail(404, "BRAND_NOT_FOUND", `No brand ${id}`);
const categoryNotFound = (id: string) => fail(404, "CATEGORY_NOT_FOUND", `No category ${id}`);

/** BE bỏ field null khỏi JSON; `createdAt` không có trong response. */
function toResponse<T extends { createdAt: string }>({ createdAt: _createdAt, ...row }: T) {
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null));
}

/** `listCategories` / `listBrands` gửi `URLSearchParams`, màn quản lý gửi object — đọc cả hai. */
const query = (config: AxiosRequestConfig): Record<string, string> =>
  Object.fromEntries(queryOf(config).entries());

/** Giá trị một cột để sắp xếp — so sánh theo code point như cột TEXT của `path`. */
const sortValue = (row: object, key: string): string | number => {
  const v = (row as Record<string, unknown>)[key];
  return typeof v === "number" ? v : String(v ?? "");
};

/** `Pages.of` + `SortWhitelist.parse` — page ≥ 0, 1 ≤ size ≤ 200, sort chỉ field cho phép. */
function pageOf<T extends { createdAt: string }>(
  rows: T[],
  q: Record<string, string>,
  allowed: string[],
  fallback: string,
) {
  const page = q.page === undefined ? 0 : Number(q.page);
  const size = q.size === undefined ? 20 : Number(q.size);
  if (!(page >= 0)) return fail(400, "UNSUPPORTED_PARAMETER", `Page number must not be negative`);
  if (!(size >= 1)) return fail(400, "UNSUPPORTED_PARAMETER", `Page size must be at least 1`);
  if (size > 200) return fail(400, "UNSUPPORTED_PARAMETER", `Page size must not exceed 200`);
  const orders = (q.sort || fallback).split(";").map((part) => {
    const [field = "", dir = "asc"] = part.split(",");
    return { field: field.trim(), desc: dir.trim().toLowerCase() === "desc" };
  });
  const bad = orders.find((o) => !allowed.includes(o.field));
  if (bad) {
    return fail(400, "UNSUPPORTED_PARAMETER", `Cannot sort by '${bad.field}'. Allowed: ${allowed}`);
  }
  const sorted = [...rows].sort((a, b) => {
    for (const { field, desc } of orders) {
      const x = sortValue(a, field);
      const y = sortValue(b, field);
      const cmp = x < y ? -1 : x > y ? 1 : 0;
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
  return ok(paginatePage(sorted.map(toResponse), page, size));
}

/** `Specs.contains(name) OR contains(code)` + `Specs.eq(active)`. */
function matches(row: { name: string; code: string; active: boolean }, q: Record<string, string>) {
  const search = text(q.q).toLowerCase();
  if (
    search &&
    !row.name.toLowerCase().includes(search) &&
    !row.code.toLowerCase().includes(search)
  )
    return false;
  return q.active === undefined || String(row.active) === q.active;
}

/** Bean Validation của `Create*Request` / `Update*Request` (chạy trên chuỗi thô). */
function validate(b: Record<string, unknown>, opts: { code: boolean; active: boolean }) {
  if (opts.code) {
    const code = typeof b.code === "string" ? b.code : "";
    if (!code.trim()) return invalid("code", "code is required");
    if (!CODE_PATTERN.test(code)) return invalid("code", "code is 1-50 letters", "Pattern");
  }
  if (!text(b.name)) return invalid("name", "name is required");
  if (text(b.name).length > 255) return invalid("name", "name must be at most 255", "Size");
  if (text(b.seoTitle).length > 255) return invalid("seoTitle", "seoTitle at most 255", "Size");
  if (opts.active && typeof b.active !== "boolean")
    return invalid("active", "active is required", "NotNull");
  return null;
}

const textOrNull = (v: unknown) => text(v) || null;
const intOrZero = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : 0);

export function registerTaxonomyMockRoutes(): void {
  registerMockRoute("GET", "/brands", async (config) => {
    const q = query(config);
    const rows = brandStore().filter((b) => matches(b, q));
    return pageOf(rows, q, BRAND_SORT, "name,asc");
  });

  registerMockRoute("GET", "/brands/:brandId", async (config) => {
    const { brandId = "" } = pathParams(config);
    const brand = findMockBrand(brandId);
    return brand ? ok(toResponse(brand)) : brandNotFound(brandId);
  });

  registerMockRoute("POST", "/brands", async (config) => {
    const b = bodyOf(config);
    const error = validate(b, { code: true, active: false });
    if (error) return error;
    const code = text(b.code).toUpperCase();
    const slug = slugOf(code);
    const store = brandStore();
    if (store.some((x) => x.code === code || x.slug === slug)) {
      return fail(409, "BRAND_CODE_ALREADY_EXISTS", `Brand ${code} exists`);
    }
    const brand: MockBrand = {
      brandId: crypto.randomUUID(),
      code,
      name: text(b.name),
      slug,
      logoUrl: textOrNull(b.logoUrl),
      active: true,
      version: 0,
      createdAt: new Date().toISOString(),
    };
    store.push(brand);
    return ok(toResponse(brand), 201);
  });

  registerMockRoute("PUT", "/brands/:brandId", async (config) => {
    const { brandId = "" } = pathParams(config);
    const brand = findMockBrand(brandId);
    if (!brand) return brandNotFound(brandId);
    const b = bodyOf(config);
    const error = validate(b, { code: false, active: true });
    if (error) return error;
    // `BrandJpaEntity.setDetails` — thay toàn bộ, null xoá giá trị; mã bất biến
    Object.assign(brand, {
      name: text(b.name),
      logoUrl: textOrNull(b.logoUrl),
      active: b.active === true,
      version: brand.version + 1,
    });
    return ok(toResponse(brand));
  });

  registerMockRoute("GET", "/categories", async (config) => {
    const q = query(config);
    // `roots=true` → parent_id IS NULL; không thì `parentId` (không truyền = mọi danh mục)
    const rows = (await categoryStore()).filter(
      (c) =>
        matches(c, q) &&
        (q.roots === "true" ? c.parentId === null : !q.parentId || c.parentId === q.parentId),
    );
    return pageOf(rows, q, CATEGORY_SORT, "path,asc");
  });

  registerMockRoute("GET", "/categories/:categoryId", async (config) => {
    const { categoryId = "" } = pathParams(config);
    const category = await findMockCategory(categoryId);
    return category ? ok(toResponse(category)) : categoryNotFound(categoryId);
  });

  registerMockRoute("POST", "/categories", async (config) => {
    const b = bodyOf(config);
    const error = validate(b, { code: true, active: false });
    if (error) return error;
    const code = text(b.code).toUpperCase();
    const slug = slugOf(code);
    const store = await categoryStore();
    if (store.some((x) => x.code === code || x.slug === slug)) {
      return fail(409, "CATEGORY_CODE_ALREADY_EXISTS", `Category ${code} exists`);
    }
    const parentId = text(b.parentId);
    const parent = parentId ? store.find((c) => c.categoryId === parentId) : undefined;
    if (parentId && !parent) return categoryNotFound(parentId);
    if (parent && parent.depth > MAX_PARENT_DEPTH) {
      return fail(400, "VALIDATION_FAILED", "The category tree is at most 11 levels deep");
    }
    const category: MockCategory = {
      categoryId: crypto.randomUUID(),
      parentId: parent?.categoryId ?? null,
      code,
      name: text(b.name),
      slug,
      path: `${parent?.path ?? ""}/${code}`,
      depth: parent ? parent.depth + 1 : 0,
      sortOrder: intOrZero(b.sortOrder),
      imageUrl: textOrNull(b.imageUrl),
      seoTitle: textOrNull(b.seoTitle),
      seoDescription: textOrNull(b.seoDescription),
      active: true,
      version: 0,
      createdAt: new Date().toISOString(),
    };
    store.push(category);
    return ok(toResponse(category), 201);
  });

  registerMockRoute("PUT", "/categories/:categoryId", async (config) => {
    const { categoryId = "" } = pathParams(config);
    const category = await findMockCategory(categoryId);
    if (!category) return categoryNotFound(categoryId);
    const b = bodyOf(config);
    const error = validate(b, { code: false, active: true });
    if (error) return error;
    // `CategoryJpaEntity.setDetails` — thay toàn bộ; mã, cha, path, depth bất biến
    Object.assign(category, {
      name: text(b.name),
      sortOrder: intOrZero(b.sortOrder),
      imageUrl: textOrNull(b.imageUrl),
      seoTitle: textOrNull(b.seoTitle),
      seoDescription: textOrNull(b.seoDescription),
      active: b.active === true,
      version: category.version + 1,
    });
    return ok(toResponse(category));
  });
}
