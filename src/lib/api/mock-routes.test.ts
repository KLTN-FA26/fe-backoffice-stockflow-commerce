import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  createProduct,
  getProduct,
  listBrands,
  listCategories,
  publishProduct,
  transitionProduct,
  unpublishProduct,
  updateProduct,
} from "@/features/product/api";
import { api } from "@/lib/api/client";

import { activateMockAdapter } from "./mock-adapter";

const originalAdapter = api.defaults.adapter;
let categoryId: string;
let brandId: string;
let otherBrandId: string;

beforeAll(async () => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();

  categoryId = (await listCategories()).items[0]?.categoryId ?? "";
  const brands = await listBrands();
  brandId = brands[0]?.brandId ?? "";
  otherBrandId = brands[1]?.brandId ?? "";
  expect(categoryId).not.toBe("");
  expect(otherBrandId).not.toBe("");
});

afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

const draftInput = (code: string) => ({
  code,
  name: "Mock product",
  nameEn: "Mock product",
  categoryId,
  brandId,
  description: "",
  descriptionEn: "",
  taxClass: "STANDARD" as const,
  kind: "STANDARD" as const,
});

describe("product mock ↔ BE PR #71 contract", () => {
  it("/categories và /brands trả PageResponse BE, map sang ô chọn của form", async () => {
    const categories = await listCategories();
    expect(categories.items[0]).toMatchObject({ level: 1, parentId: null });
    expect(categories.items.some((c) => c.level === 2)).toBe(true);
    expect((await listBrands()).map((b) => b.name)).toEqual(["Gildan", "StockFlow Basics"]);
  });

  it("tạo / sửa giữ brandId + tên thương hiệu và kind; không còn ảnh trên sản phẩm", async () => {
    const created = await createProduct({
      ...draftInput(`MOCK-BRAND-${Date.now()}`),
      kind: "CUSTOMIZABLE",
    });
    expect(created).toMatchObject({ brandId, type: "Customizable", images: [] });
    expect(created.brand).not.toBe("");

    await updateProduct({
      id: created.productId,
      ...draftInput(created.productId),
      brandId: otherBrandId,
      shortDescription: "Cốc giấy 12oz",
    });
    expect(await getProduct(created.productId)).toMatchObject({
      brandId: otherBrandId,
      type: "Standard",
      shortDescription: "Cốc giấy 12oz",
    });
  });
});

describe("product mock lifecycle contract", () => {
  it("mirrors data-returning and void backend transitions", async () => {
    const created = await createProduct(draftInput(`MOCK-LIFECYCLE-${Date.now()}`));

    const submitted = await transitionProduct({ id: created.productId, action: "submit" });
    expect(submitted.status).toBe("Pending Approval");
    expect(submitted.submittedBy).toBeTruthy();

    const approved = await transitionProduct({ id: created.productId, action: "approve" });
    expect(approved.status).toBe("Approved");
    await expect(publishProduct(created.productId)).resolves.toBeUndefined();
    expect((await getProduct(created.productId)).status).toBe("Published");
    await expect(unpublishProduct(created.productId)).resolves.toBeUndefined();
    expect((await getProduct(created.productId)).status).toBe("Approved");
  });
});

// Regression review PR #12: màn legacy gửi `page=1&pageSize=` — paginate() dùng chung
// không được đổi sang 0-based, nếu không các list này rỗng ở chế độ mock.
// `/purchase-orders` không còn ở đây: PR #14 đã chuyển sang route mock khớp BE PageResponse.
// `/receipts` cũng vậy: SCRUM-436 bỏ màn mock, phiếu nhận dùng `/goods-receipts` khớp BE PR #62.
describe("legacy mock lists vẫn có dữ liệu với page=1&pageSize=500", () => {
  it.each(["/invoices"])("%s", async (path) => {
    const response = await api.get<{ items: unknown[]; total: number }>(path, {
      params: { page: 1, pageSize: 500 },
    });
    expect(response.data.items.length).toBeGreaterThan(0);
    expect(response.data.items).toHaveLength(response.data.total);
  });
});
