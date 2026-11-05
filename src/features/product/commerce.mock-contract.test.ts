/**
 * Contract test: mock adapter nói đúng hợp đồng BE cho listing TMĐT / giá cơ sở
 * (`CatalogManagementController`) để `listing-api.ts` (parse zod) chạy y hệt trên mock và BE thật.
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
import { getListing, getSkuPrice, saveListing, saveSkuPrice } from "./listing-api";
import { listVariants } from "./variant-api";

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
    nameEn: "Commerce product",
    categoryId: category?.categoryId ?? "",
    brandId: brand?.brandId ?? "",
    description: "",
    descriptionEn: "",
    taxClass: "STANDARD",
    kind: "STANDARD",
  });
  const [variant] = await listVariants(product.productId);
  if (!variant) throw new Error("no default variant");
  return { product, variant };
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
  it("lưu listing / đặt giá làm tăng version sản phẩm; thao tác sản phẩm làm đổi revision của listing", async () => {
    const { product, variant } = await draft();
    expect(product.version).toBe(0);
    const listing = await saveListing({
      productId: product.productId,
      revision: 0,
      values: { slug: `v-${Date.now()}`, seoTitle: "", seoDescription: "" },
    });
    expect(listing.revision).toBe(1);
    expect((await getProduct(product.productId)).version).toBe(1);

    const priced = await saveSkuPrice({
      productId: product.productId,
      sku: variant.sku,
      revision: 1,
      price: 100000,
    });
    expect(priced.revision).toBe(2);
    expect((await getProduct(product.productId)).version).toBe(2);

    // Gửi duyệt là thao tác sản phẩm → listing sang revision mới, revision cũ bị từ chối.
    const submitted = await transitionProduct({ id: product.productId, action: "submit" });
    expect(submitted.version).toBe(3);
    expect((await getListing(product.productId)).revision).toBe(3);
    expect((await getSkuPrice(product.productId, variant.sku)).revision).toBe(3);
    const stale = await apiError(
      saveSkuPrice({ productId: product.productId, sku: variant.sku, revision: 2, price: 120000 }),
    );
    expect(stale.code).toBe("CONFLICT");
  });

  it("chờ duyệt vẫn đặt giá và sửa listing được (BE chỉ từ chối DISCONTINUED)", async () => {
    const { product, variant } = await draft();
    await saveListing({
      productId: product.productId,
      revision: 0,
      values: { slug: `w-${Date.now()}`, seoTitle: "", seoDescription: "" },
    });
    const submitted = await transitionProduct({ id: product.productId, action: "submit" });
    const priced = await saveSkuPrice({
      productId: product.productId,
      sku: variant.sku,
      revision: submitted.version,
      price: 90000,
    });
    expect(priced.revision).toBe(submitted.version + 1);
  });
});

describe("giá bán cơ sở (BE GET/PUT /products/{id}/skus/{sku}/base-price — theo MÃ SKU)", () => {
  it("phải lưu listing trước (409 CATALOG_LISTING_REQUIRED); sau đó đặt giá, revision tăng và dùng chung với listing", async () => {
    const { product, variant } = await draft();
    const empty = await getSkuPrice(product.productId, variant.sku);
    expect(empty).toMatchObject({ sku: variant.sku, revision: 0 });
    // BE `non_null`: SKU chưa có giá → các trường giá vắng mặt.
    expect(empty.basePrice).toBeUndefined();
    expect(empty.effectivePrice).toBeUndefined();
    expect(empty.baseCurrency).toBeUndefined();

    const early = await apiError(
      saveSkuPrice({ productId: product.productId, sku: variant.sku, revision: 0, price: 149000 }),
    );
    expect(early.code).toBe("CATALOG_LISTING_REQUIRED");

    const listing = await saveListing({
      productId: product.productId,
      revision: 0,
      values: { slug: `p-${Date.now()}`, seoTitle: "", seoDescription: "" },
    });
    const priced = await saveSkuPrice({
      productId: product.productId,
      sku: variant.sku,
      revision: listing.revision,
      price: 149000,
    });
    expect(priced.revision).toBe(listing.revision + 1);
    expect(await getSkuPrice(product.productId, variant.sku)).toMatchObject({
      basePrice: 149000,
      baseCurrency: "VND",
      revision: priced.revision,
    });
    // Revision của lần đọc trước nay đã cũ.
    const stale = await apiError(
      saveSkuPrice({
        productId: product.productId,
        sku: variant.sku,
        revision: listing.revision,
        price: 150000,
      }),
    );
    expect(stale.code).toBe("CONFLICT");
  });

  it("giá là số nguyên VND > 0; SKU không thuộc sản phẩm (kể cả variantId) → 404 NOT_FOUND", async () => {
    const { product, variant } = await draft();
    const listing = await saveListing({
      productId: product.productId,
      revision: 0,
      values: { slug: `q-${Date.now()}`, seoTitle: "", seoDescription: "" },
    });
    const put = (price: number) =>
      saveSkuPrice({
        productId: product.productId,
        sku: variant.sku,
        revision: listing.revision,
        price,
      });
    expect((await apiError(put(0))).code).toBe("VALIDATION_FAILED");
    expect((await apiError(put(-5))).code).toBe("VALIDATION_FAILED");
    expect((await apiError(put(12.5))).code).toBe("VALIDATION_FAILED");
    // `{sku}` là mã SKU: variantId (UUID) không phải mã SKU.
    expect((await apiError(getSkuPrice(product.productId, variant.variantId))).code).toBe(
      "NOT_FOUND",
    );
    expect(
      (
        await apiError(
          saveSkuPrice({
            productId: product.productId,
            sku: "KHONG-CO",
            revision: listing.revision,
            price: 1000,
          }),
        )
      ).code,
    ).toBe("NOT_FOUND");
    expect(await getProduct(product.productId)).toBeTruthy();
  });

  it("SKU mẫu của sản phẩm đang bán có sẵn giá cơ sở từ dữ liệu mẫu", async () => {
    const variants = await listVariants("PRD-001");
    const price = await getSkuPrice("PRD-001", variants[0]?.sku ?? "");
    expect(price.basePrice).toBeGreaterThan(0);
    expect(price.baseCurrency).toBe("VND");
  });
});
