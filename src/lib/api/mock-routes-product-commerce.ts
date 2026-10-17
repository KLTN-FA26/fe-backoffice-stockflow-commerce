/**
 * Mock routes — chính sách tồn kho theo SKU, listing TMĐT và giá bán cơ sở của sản phẩm:
 *  - `GET/PUT /products/{id}/skus/{variantId}/inventory-control` (BE `InventoryControlController`,
 *    `StockPolicy.validate`);
 *  - `GET/PUT /products/{id}/ecommerce`, `GET/PUT /products/{id}/skus/{sku}/base-price`
 *    (BE `CatalogManagementController`, `Listing.edit`, `SellingPrice`) — base-price nhận MÃ SKU,
 *    không phải variantId.
 * Phiên bản tăng sau mỗi lần ghi; lệch → 409 như BE (inventory-control và listing dùng CONFLICT, không
 * phải OPTIMISTIC_LOCK). `revision` của listing CHÍNH LÀ `version` của sản phẩm (BE
 * `CatalogCommerceService.get`: `source.version()`): sửa listing / đặt giá làm tăng version sản phẩm, và
 * mọi thao tác sản phẩm (tạm ngưng, sửa…) làm đổi revision của listing.
 */

import { registerMockRoute } from "./mock-adapter";
import { recordMockHistory } from "./mock-product-history";
import {
  allMockProducts,
  findMockProduct,
  mockProductAcceptsChanges,
  saveMockProduct,
} from "./mock-product-store";
import { bodyOf, fail, ok, pathParams, slugCode, validationFailed } from "./mock-route-utils";
import { mockUnitOfMeasure, mockVariantsOf } from "./mock-routes-variants";

import type { MockProduct } from "./mock-product-store";

type RemovalStrategy = "FIFO" | "FEFO";
type TrackingMode = "NONE" | "LOT" | "SERIAL" | "LOT_SERIAL";

interface MockPolicy {
  version: number;
  reorderPoint: number | null;
  safetyStock: number | null;
  removalStrategy: RemovalStrategy;
  trackingMode: TrackingMode;
  expiryTracked: boolean;
  maxShelfLifeDays: number | null;
}

interface MockListing {
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  /** Đã có bản ghi listing (BE `CATALOG_LISTING_REQUIRED` khi đặt giá mà chưa có). */
  exists: boolean;
  everPublished: boolean;
}

const policies = new Map<string, MockPolicy>();
const listings = new Map<string, MockListing>();
/** Giá bán cơ sở theo MÃ SKU (VND, số nguyên). */
const basePrices = new Map<string, number>();

export function resetProductCommerceMock(): void {
  policies.clear();
  listings.clear();
  basePrices.clear();
}

const isLotTracked = (mode: TrackingMode) => mode === "LOT" || mode === "LOT_SERIAL";
const trackingModeOf = (lot: boolean, serial: boolean): TrackingMode =>
  lot ? (serial ? "LOT_SERIAL" : "LOT") : serial ? "SERIAL" : "NONE";

/** Tồn khả dụng của SKU seed (BE: `usableOnHand` của kho); SKU tạo mới trong mock chưa có tồn. */
async function usableOnHand(sku: string): Promise<number> {
  const { skus } = await import("@/lib/mock-data");
  return skus.find((s) => s.skuId === sku)?.stockOnHand ?? 0;
}

async function policyOf(variantId: string, sku: string): Promise<MockPolicy> {
  const existing = policies.get(variantId);
  if (existing) return existing;
  const { skus } = await import("@/lib/mock-data");
  const seed = skus.find((s) => s.skuId === sku);
  const mode = trackingModeOf(Boolean(seed?.lotTracking), Boolean(seed?.serialTracking));
  const policy: MockPolicy = {
    version: 0,
    reorderPoint: seed ? seed.reorderPoint : null,
    safetyStock: null,
    // BE mặc định FEFO; theo dõi hạn dùng chỉ hợp lệ khi theo lô + FEFO (`StockPolicy.validate`).
    removalStrategy: "FEFO",
    trackingMode: mode,
    expiryTracked: Boolean(seed?.expiryTracking) && isLotTracked(mode),
    maxShelfLifeDays: null,
  };
  policies.set(variantId, policy);
  return policy;
}

const nullableInt = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) =>
  value === null || value === undefined
    ? null
    : typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
      ? value
      : undefined;

async function inventoryView(variantId: string, sku: string, policy: MockPolicy) {
  const onHand = await usableOnHand(sku);
  return {
    skuId: variantId,
    sku,
    unitOfMeasure: mockUnitOfMeasure(variantId),
    version: policy.version,
    reorderPoint: policy.reorderPoint,
    safetyStock: policy.safetyStock,
    removalStrategy: policy.removalStrategy,
    trackingMode: policy.trackingMode,
    expiryTracked: policy.expiryTracked,
    maxShelfLifeDays: policy.maxShelfLifeDays,
    usableOnHand: onHand,
    // BE `StockThresholds`: ở hoặc dưới điểm đặt hàng lại / thấp hơn hẳn tồn an toàn.
    reorderRequired: policy.reorderPoint === null ? null : onHand <= policy.reorderPoint,
    belowSafetyStock: policy.safetyStock === null ? null : onHand < policy.safetyStock,
  };
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

/** Ghi vào listing / giá làm tăng version sản phẩm, như BE (`editEcommerce`, `advanceCommerceRevision`). */
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

/** Giá cơ sở của SKU seed lấy từ giá bán trong mock-data khi sản phẩm đã có listing. */
async function basePriceOf(sku: string, listing: MockListing): Promise<number | null> {
  const stored = basePrices.get(sku);
  if (stored !== undefined) return stored;
  if (!listing.exists) return null;
  const { skus } = await import("@/lib/mock-data");
  return skus.find((s) => s.skuId === sku)?.price ?? null;
}

const notFound = (what: string) => fail(404, "NOT_FOUND", `${what} not found`);

export function registerProductCommerceMockRoutes(): void {
  registerMockRoute("GET", "/products/:id/skus/:variantId/inventory-control", async (config) => {
    const { id, variantId } = pathParams(config);
    if (!(await findMockProduct(id ?? "")))
      return fail(404, "PRODUCT_NOT_FOUND", "Product not found");
    const variant = (await mockVariantsOf(id ?? "")).find((v) => v.variantId === variantId);
    if (!variant) return fail(404, "VARIANT_NOT_FOUND", "Variant not found");
    return ok(
      await inventoryView(
        variant.variantId,
        variant.sku,
        await policyOf(variant.variantId, variant.sku),
      ),
    );
  });

  registerMockRoute("PUT", "/products/:id/skus/:variantId/inventory-control", async (config) => {
    const { id, variantId } = pathParams(config);
    const product = await findMockProduct(id ?? "");
    if (!product) return fail(404, "PRODUCT_NOT_FOUND", "Product not found");
    const variant = (await mockVariantsOf(id ?? "")).find((v) => v.variantId === variantId);
    if (!variant) return fail(404, "VARIANT_NOT_FOUND", "Variant not found");
    const b = bodyOf(config);
    // Bean validation của `UpdateInventoryControlRequest`.
    if (typeof b.version !== "number" || b.version < 0)
      return validationFailed("version", "version is required");
    const reorderPoint = nullableInt(b.reorderPoint, 0);
    const safetyStock = nullableInt(b.safetyStock, 0);
    const maxShelfLifeDays = nullableInt(b.maxShelfLifeDays, 1, 36500);
    if (reorderPoint === undefined)
      return validationFailed("reorderPoint", "reorderPoint must be at least 0");
    if (safetyStock === undefined)
      return validationFailed("safetyStock", "safetyStock must be at least 0");
    if (maxShelfLifeDays === undefined)
      return validationFailed("maxShelfLifeDays", "maxShelfLifeDays must be 1-36500");
    if (b.removalStrategy !== "FIFO" && b.removalStrategy !== "FEFO")
      return validationFailed("removalStrategy", "removalStrategy is required");
    if (!["NONE", "LOT", "SERIAL", "LOT_SERIAL"].includes(String(b.trackingMode)))
      return validationFailed("trackingMode", "trackingMode is required");
    if (typeof b.expiryTracked !== "boolean")
      return validationFailed("expiryTracked", "expiryTracked is required");
    const trackingMode = b.trackingMode as TrackingMode;
    // BE `StockPolicy.validate` (docs 01 §3 "kiểm soát tồn kho"): an toàn ≤ điểm đặt lại; theo dõi
    // hạn dùng cần theo lô + FEFO; hạn dùng tối đa chỉ có khi theo dõi hạn dùng.
    if (
      (reorderPoint !== null && safetyStock !== null && safetyStock > reorderPoint) ||
      (b.expiryTracked && (!isLotTracked(trackingMode) || b.removalStrategy !== "FEFO")) ||
      (!b.expiryTracked && maxShelfLifeDays !== null)
    ) {
      return fail(400, "INVENTORY_POLICY_INVALID", "Invalid SKU inventory policy");
    }
    // BE `SkuInventoryControlService.update`: không sửa khi sản phẩm chờ duyệt / đã ngừng.
    if (!mockProductAcceptsChanges(product)) return fail(409, "CONFLICT", "Conflicting state");
    const current = await policyOf(variant.variantId, variant.sku);
    if (b.version !== current.version) return fail(409, "CONFLICT", "Conflicting state");
    const next: MockPolicy = {
      version: current.version + 1,
      reorderPoint,
      safetyStock,
      removalStrategy: b.removalStrategy,
      trackingMode,
      expiryTracked: b.expiryTracked,
      maxShelfLifeDays,
    };
    const changed = (
      [
        "reorderPoint",
        "safetyStock",
        "removalStrategy",
        "trackingMode",
        "expiryTracked",
        "maxShelfLifeDays",
      ] as const
    ).filter((key) => current[key] !== next[key]);
    policies.set(variant.variantId, next);
    if (changed.length > 0) {
      recordMockHistory(id ?? "", "INVENTORY_CONTROL", {
        subjectId: variant.variantId,
        changedFields: [...changed],
      });
    }
    return ok(await inventoryView(variant.variantId, variant.sku, next));
  });

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

  registerMockRoute("GET", "/products/:id/skus/:sku/base-price", async (config) => {
    const { id, sku } = pathParams(config);
    const product = await findMockProduct(id ?? "");
    if (!product) return fail(404, "PRODUCT_NOT_FOUND", "Product not found");
    if (!(await mockVariantsOf(id ?? "")).some((v) => v.sku === sku)) return notFound("SKU");
    const listing = await listingOf(product);
    const price = await basePriceOf(sku ?? "", listing);
    return ok({
      sku,
      revision: revisionOf(product),
      basePrice: price,
      baseCurrency: price === null ? null : "VND",
      effectivePrice: price,
      effectiveCurrency: price === null ? null : "VND",
    });
  });

  registerMockRoute("PUT", "/products/:id/skus/:sku/base-price", async (config) => {
    const { id, sku } = pathParams(config);
    const product = await findMockProduct(id ?? "");
    if (!product) return fail(404, "PRODUCT_NOT_FOUND", "Product not found");
    const b = bodyOf(config);
    if (typeof b.revision !== "number" || b.revision < 0)
      return validationFailed("revision", "revision is required");
    if (typeof b.price !== "number" || !(b.price > 0))
      return validationFailed("price", "price must be greater than 0");
    if (b.currency !== "VND") return validationFailed("currency", "currency must be VND");
    if (product.status === "Discontinued") return fail(409, "CONFLICT", "Conflicting state");
    if (!(await mockVariantsOf(id ?? "")).some((v) => v.sku === sku)) return notFound("SKU");
    // BE `SellingPrice`: số nguyên VND, tối đa 16 chữ số — không làm tròn giá đã thoả thuận.
    if (!Number.isInteger(b.price) || String(b.price).length > 16)
      return fail(400, "VALIDATION_FAILED", "Invalid price");
    const listing = await listingOf(product);
    if (!listing.exists)
      return fail(
        409,
        "CATALOG_LISTING_REQUIRED",
        "Configure the storefront listing before publishing",
      );
    if (b.revision !== revisionOf(product)) return fail(409, "CONFLICT", "Conflicting state");
    basePrices.set(sku ?? "", b.price);
    return ok(listingView(listing, bumpProductVersion(product)));
  });
}
