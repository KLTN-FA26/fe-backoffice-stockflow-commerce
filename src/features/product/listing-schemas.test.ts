import { describe, expect, it } from "vitest";

import { toListingRequest } from "./listing-api";
import {
  basePriceFormSchema,
  beListingSchema,
  beSkuPriceSchema,
  listingFormSchema,
  normalizeSlug,
} from "./listing-schemas";

describe("normalizeSlug (BE Listing.normalizeSlug)", () => {
  it.each([
    ["Ly giấy 12oz", "ly-giay-12oz"],
    ["  Đồng Hồ  ", "dong-ho"],
    ["--A__B--", "a-b"],
    ["Ghế   Xoay!!", "ghe-xoay"],
    ["***", ""],
  ])("%s → %s", (input, expected) => {
    expect(normalizeSlug(input)).toBe(expected);
  });
});

describe("listing form (BE EditListingRequest)", () => {
  const form = { slug: "ly-giay", seoTitle: "", seoDescription: "" };

  it("slug is required, ≤ 300, and must keep a letter or digit after normalisation", () => {
    expect(listingFormSchema.safeParse(form).success).toBe(true);
    expect(listingFormSchema.safeParse({ ...form, slug: "  " }).success).toBe(false);
    expect(listingFormSchema.safeParse({ ...form, slug: "***" }).success).toBe(false);
    expect(listingFormSchema.safeParse({ ...form, slug: "a".repeat(301) }).success).toBe(false);
    // 256 ký tự sau chuẩn hoá vượt giới hạn 255 của BE.
    expect(listingFormSchema.safeParse({ ...form, slug: "a".repeat(256) }).success).toBe(false);
    expect(listingFormSchema.safeParse({ ...form, slug: "a".repeat(255) }).success).toBe(true);
  });

  it("SEO title ≤ 255 and description ≤ 5000", () => {
    expect(listingFormSchema.safeParse({ ...form, seoTitle: "x".repeat(256) }).success).toBe(false);
    expect(listingFormSchema.safeParse({ ...form, seoDescription: "x".repeat(5001) }).success).toBe(
      false,
    );
    expect(listingFormSchema.safeParse({ ...form, seoDescription: "x".repeat(5000) }).success).toBe(
      true,
    );
  });

  it("request carries the revision read and omits blank SEO fields", () => {
    expect(
      toListingRequest({ slug: " ly-giay ", seoTitle: " ", seoDescription: "Mô tả" }, 4),
    ).toEqual({
      revision: 4,
      slug: "ly-giay",
      seoTitle: undefined,
      seoDescription: "Mô tả",
    });
  });
});

describe("base price form (BE SetBasePriceRequest / SellingPrice)", () => {
  it("is a positive whole VND amount of at most 16 digits", () => {
    for (const ok of ["1", "149000", "9".repeat(16)]) {
      expect(basePriceFormSchema.safeParse({ price: ok }).success).toBe(true);
    }
    for (const bad of ["", "0", "-5", "12.5", "1e3", "abc", "9".repeat(17), "012"]) {
      expect(basePriceFormSchema.safeParse({ price: bad }).success).toBe(false);
    }
  });
});

describe("listing / price DTOs", () => {
  it("parses ListingResponse including the -1 projected revision of a listing never projected", () => {
    const listing = beListingSchema.parse({
      productId: "p",
      slug: null,
      seoTitle: null,
      seoDescription: null,
      revision: 0,
      projectedRevision: -1,
      published: false,
      projectionPending: true,
    });
    expect(listing.projectedRevision).toBe(-1);
  });

  it("parses SkuPriceResponse BigDecimal as number or string, null when no price", () => {
    expect(
      beSkuPriceSchema.parse({
        sku: "A",
        revision: 1,
        basePrice: "149000.00",
        baseCurrency: "VND",
        effectivePrice: 149000,
        effectiveCurrency: "VND",
      }),
    ).toMatchObject({ basePrice: 149000, effectivePrice: 149000 });
    expect(
      beSkuPriceSchema.parse({
        sku: "A",
        revision: 1,
        basePrice: null,
        baseCurrency: null,
        effectivePrice: null,
        effectiveCurrency: null,
      }).basePrice,
    ).toBeNull();
  });
});
