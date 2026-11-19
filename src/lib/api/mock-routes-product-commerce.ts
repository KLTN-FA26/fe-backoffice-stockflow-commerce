/**
 * Mock routes — listing TMĐT của sản phẩm: `GET/PUT /products/{id}/ecommerce` (BE
 * `CatalogManagementController`, `Listing.edit`). Không còn giá bán cơ sở (kltn-docs 13 BR-04).
 * Phiên bản tăng sau mỗi lần ghi; lệch → 409 CONFLICT như BE (không phải OPTIMISTIC_LOCK).
 * `revision` của listing CHÍNH LÀ `version` của sản phẩm (BE
 * `CatalogCommerceService.get`: `source.version()`): sửa listing làm tăng version sản phẩm, và
 * mọi thao tác sản phẩm (tạm ngưng, sửa…) làm đổi revision của listing.
 */

import { registerMockRoute } from "./mock-adapter";
import { allMockProducts, findMockProduct, saveMockProduct } from "./mock-product-store";
import { bodyOf, fail, ok, pathParams, slugCode, validationFailed } from "./mock-route-utils";

import type { MockProduct } from "./mock-product-store";

interface MockListing {
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  /** Đã có bản ghi listing (BE `CATALOG_LISTING_REQUIRED` khi xuất bản mà chưa có). */
  exists: boolean;
  everPublished: boolean;
}

const listings = new Map<string, MockListing>();

export function resetProductCommerceMock(): void {
  listings.clear();
}

/** BE `Listing.normalizeSlug`: bỏ dấu, chữ thường, ngăn bằng '-', tối đa 255. */
function normalizeSlug(input: string): string {
  return slugCode(input.trim().toLowerCase()).toLowerCase();
}

async function listingOf(product: MockProduct): Promise<MockListing> {
  const existing = listings.get(product.productId);
  if (existing) return existing;
  const published = product.status === "Published";
  const listing: MockListing = {
    slug: product.slug || normalizeSlug(product.name),
    seoTitle: null,
    seoDescription: null,
    // Sản phẩm đang bán đã có listing; còn lại thì chưa cho tới lần lưu đầu tiên.
    exists: published,
    everPublished: published,
  };
  listings.set(product.productId, listing);
  return listing;
}

/** Revision của listing = version của sản phẩm (dùng chung một bộ đếm). */
const revisionOf = (product: MockProduct): number => product.version ?? 0;

/** Ghi vào listing làm tăng version sản phẩm, như BE (`editEcommerce`, `advanceCommerceRevision`). */
function bumpProductVersion(product: MockProduct): MockProduct {
  const bumped = { ...product, version: revisionOf(product) + 1 };
  saveMockProduct(bumped);
  return bumped;
}

const listingView = (listing: MockListing, product: MockProduct) => ({
  productId: product.productId,
  slug: listing.slug,
  seoTitle: listing.seoTitle,
  seoDescription: listing.seoDescription,
  revision: revisionOf(product),
  projectedRevision: revisionOf(product),
  published: product.status === "Published",
  projectionPending: false,
});

export function registerProductCommerceMockRoutes(): void {
  registerMockRoute("GET", "/products/:id/ecommerce", async (config) => {
    const product = await findMockProduct(pathParams(config).id ?? "");
    if (!product) return fail(404, "PRODUCT_NOT_FOUND", "Product not found");
    return ok(listingView(await listingOf(product), product));
  });

  registerMockRoute("PUT", "/products/:id/ecommerce", async (config) => {
    const product = await findMockProduct(pathParams(config).id ?? "");
    if (!product) return fail(404, "PRODUCT_NOT_FOUND", "Product not found");
    const b = bodyOf(config);
    if (typeof b.revision !== "number" || b.revision < 0)
      return validationFailed("revision", "revision is required");
    const rawSlug = typeof b.slug === "string" ? b.slug : "";
    if (!rawSlug.trim() || rawSlug.length > 300)
      return validationFailed("slug", "slug is required (at most 300 characters)");
    const seoTitle = typeof b.seoTitle === "string" ? b.seoTitle : null;
    const seoDescription = typeof b.seoDescription === "string" ? b.seoDescription : null;
    if (seoTitle !== null && seoTitle.length > 255)
      return validationFailed("seoTitle", "seoTitle must be at most 255 characters");
    if (seoDescription !== null && seoDescription.length > 5000)
      return validationFailed("seoDescription", "seoDescription must be at most 5000 characters");
    if (product.status === "Discontinued") return fail(409, "CONFLICT", "Conflicting state");
    const listing = await listingOf(product);
    const slug = normalizeSlug(rawSlug);
    if (!slug || slug.length > 255) return fail(400, "VALIDATION_FAILED", "Invalid slug");
    if (b.revision !== revisionOf(product)) return fail(409, "CONFLICT", "Conflicting state");
    // BE `Listing.edit`: slug cố định sau khi đã từng xuất bản.
    if (listing.everPublished && slug !== listing.slug)
      return fail(409, "CONFLICT", "Conflicting state");
    const taken = (await allMockProducts()).some(
      (other) =>
        other.productId !== product.productId && listings.get(other.productId)?.slug === slug,
    );
    if (taken) return fail(409, "CATALOG_SLUG_EXISTS", "This storefront URL is already reserved");
    Object.assign(listing, {
      slug,
      seoTitle: seoTitle?.trim() || null,
      seoDescription: seoDescription?.trim() || null,
      exists: true,
    });
    return ok(listingView(listing, bumpProductVersion(product)));
  });
}
