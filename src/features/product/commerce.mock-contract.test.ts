/**
 * Contract test: mock adapter nói đúng hợp đồng BE cho listing TMĐT (`CatalogManagementController`) để `listing-api.ts` (parse zod) chạy y hệt trên mock và BE thật.
 * Chính sách tồn kho theo SKU đã rời sản phẩm (BE PR #119) — xem `/inventory/items`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductHistoryMock } from "@/lib/api/mock-product-history";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { resetProductCommerceMock } from "@/lib/api/mock-routes-product-commerce";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import {
  createProduct,
  discontinueProduct,
  getProduct,
  listBrands,
  listCategories,
  transitionProduct,
} from "./api";
import { getListing, saveListing } from "./listing-api";

vi.setConfig({ testTimeout: 60_000 });

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetProductMockStore();
  resetProductHistoryMock();
  resetVariantMockStore();
  resetProductCommerceMock();
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

let n = 0;
async function draft(name = "Sản phẩm bán") {
  const [category] = (await listCategories()).items;
  const [brand] = await listBrands();
  n += 1;
  const product = await createProduct({
    code: `COM-${Date.now()}-${n}`,
    name,
    categoryId: category?.categoryId ?? "",
    brandId: brand?.brandId ?? "",
    description: "",
    taxClass: "STANDARD",
  });
  return { product };
}

describe("listing TMĐT (BE GET/PUT /products/{id}/ecommerce)", () => {
  it("sản phẩm mới: slug gợi ý từ tên, revision 0, chưa hiển thị; lưu chuẩn hoá slug và tăng revision", async () => {
    const { product } = await draft("Ly Giấy Mới");
    const before = await getListing(product.productId);
    expect(before).toMatchObject({ revision: 0, published: false, projectionPending: false });
    const saved = await saveListing({
      productId: product.productId,
      revision: 0,
      values: { slug: "  Ly Giấy Đặc Biệt!  ", seoTitle: "Tiêu đề", seoDescription: "" },
    });
    expect(saved).toMatchObject({
      slug: "ly-giay-dac-biet",
      seoTitle: "Tiêu đề",
      revision: 1,
    });
    // BE `non_null`: SEO chưa đặt bị bỏ khỏi JSON (không phải null).
    expect(saved.seoDescription).toBeUndefined();
  });

  it("revision cũ → 409 CONFLICT; slug đã có sản phẩm khác dùng → 409 CATALOG_SLUG_EXISTS", async () => {
    const first = await draft("Sản phẩm một");
    const second = await draft("Sản phẩm hai");
    const unique = `slug-${Date.now()}`;
    await saveListing({
      productId: first.product.productId,
      revision: 0,
      values: { slug: unique, seoTitle: "", seoDescription: "" },
    });
    const taken = await apiError(
      saveListing({
        productId: second.product.productId,
        revision: 0,
        values: { slug: unique, seoTitle: "", seoDescription: "" },
      }),
    );
    expect(taken).toMatchObject({ code: "CATALOG_SLUG_EXISTS", status: 409 });
    const stale = await apiError(
      saveListing({
        productId: first.product.productId,
        revision: 0,
        values: { slug: unique, seoTitle: "", seoDescription: "" },
      }),
    );
    expect(stale.code).toBe("CONFLICT");
  });

  it("sản phẩm đã từng xuất bản: slug cố định (đổi → CONFLICT), giữ nguyên slug thì sửa SEO được", async () => {
    const listing = await getListing("PRD-001");
    expect(listing.published).toBe(true);
    const changed = await apiError(
      saveListing({
        productId: "PRD-001",
        revision: listing.revision,
        values: { slug: "slug-khac", seoTitle: "", seoDescription: "" },
      }),
    );
    expect(changed.code).toBe("CONFLICT");
    const kept = await saveListing({
      productId: "PRD-001",
      revision: listing.revision,
      values: { slug: listing.slug ?? "", seoTitle: "SEO mới", seoDescription: "" },
    });
    expect(kept).toMatchObject({ seoTitle: "SEO mới", revision: listing.revision + 1 });
  });

  it("sản phẩm đã ngừng kinh doanh không sửa được → 409 CONFLICT", async () => {
    const { product } = await draft();
    await transitionProduct({ id: product.productId, action: "submit" });
    const approved = await transitionProduct({ id: product.productId, action: "approve" });
    await discontinueProduct({
      id: product.productId,
      reason: "Hết mẫu",
      version: approved.version,
    });
    const refused = await apiError(
      saveListing({
        productId: product.productId,
        revision: 0,
        values: { slug: "x-y", seoTitle: "", seoDescription: "" },
      }),
    );
    expect(refused.code).toBe("CONFLICT");
  });

  it("sản phẩm không tồn tại → 404", async () => {
    expect((await apiError(getListing("không-có"))).code).toBe("PRODUCT_NOT_FOUND");
  });
});

describe("revision của listing = version của sản phẩm (BE CatalogCommerceService.get)", () => {
  it("lưu listing làm tăng version sản phẩm; thao tác sản phẩm làm đổi revision của listing", async () => {
    const { product } = await draft();
    expect(product.version).toBe(0);
    const listing = await saveListing({
      productId: product.productId,
      revision: 0,
      values: { slug: `v-${Date.now()}`, seoTitle: "", seoDescription: "" },
    });
    expect(listing.revision).toBe(1);
    expect((await getProduct(product.productId)).version).toBe(1);

    // Gửi duyệt là thao tác sản phẩm → listing sang revision mới, revision cũ bị từ chối.
    const submitted = await transitionProduct({ id: product.productId, action: "submit" });
    expect(submitted.version).toBe(2);
    expect((await getListing(product.productId)).revision).toBe(2);
    const stale = await apiError(
      saveListing({
        productId: product.productId,
        revision: 1,
        values: { slug: `v2-${Date.now()}`, seoTitle: "", seoDescription: "" },
      }),
    );
    expect(stale.code).toBe("CONFLICT");
  });

  it("chờ duyệt vẫn sửa listing được (BE chỉ từ chối DISCONTINUED)", async () => {
    const { product } = await draft();
    const submitted = await transitionProduct({ id: product.productId, action: "submit" });
    const saved = await saveListing({
      productId: product.productId,
      revision: submitted.version,
      values: { slug: `w-${Date.now()}`, seoTitle: "", seoDescription: "" },
    });
    expect(saved.revision).toBe(submitted.version + 1);
  });
});
