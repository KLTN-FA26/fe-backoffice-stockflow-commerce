import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { getCanonicalVariant, listCanonicalVariants } from "./variant-api";
import { canonicalVariantDtoSchema, canonicalVariantPageSchema } from "./variant-schemas";

const productId = "11111111-1111-4111-8111-111111111111";
const variantId = "22222222-2222-4222-8222-222222222222";
const variant = {
  productId,
  variantId,
  sku: "CHAIR-BLUE",
  name: "Blue chair",
  status: "DRAFT",
  defaultVariant: false,
  attributeSignature: "COLOR=BLUE",
  position: 0,
  version: 1,
};
const page = {
  items: [variant],
  page: 2,
  size: 15,
  totalElements: 61,
  totalPages: 5,
  hasNext: true,
  hasPrevious: true,
};

afterEach(() => vi.restoreAllMocks());

describe("canonical variant read contract", () => {
  it("keeps Product UUID, Variant UUID and SKU code separate and uses direct detail", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: variant });
    const signal = new AbortController().signal;
    const result = await getCanonicalVariant(productId, variantId, signal);
    expect(result.identity).toEqual({ productId, variantId, sku: variant.sku });
    expect(result.identity).not.toHaveProperty("skuId");
    expect(get).toHaveBeenCalledExactlyOnceWith(`/products/${productId}/variants/${variantId}`, {
      signal,
    });
  });
  it.each(["productId", "variantId"] as const)(
    "rejects a returned %s that does not match the route",
    async (field) => {
      vi.spyOn(api, "get").mockResolvedValue({
        data: { ...variant, [field]: "33333333-3333-4333-8333-333333333333" },
      });
      await expect(getCanonicalVariant(productId, variantId)).rejects.toThrow("không khớp");
    },
  );
  it("does not substitute a legacy SKU code for a UUID", async () => {
    const get = vi.spyOn(api, "get");
    await expect(getCanonicalVariant(productId, "SKU-001-BLK-L")).rejects.toThrow();
    expect(get).not.toHaveBeenCalled();
  });
  it("preserves every server pagination field and cancellation", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: page });
    const signal = new AbortController().signal;
    const result = await listCanonicalVariants(productId, { page: 2, size: 15 }, signal);
    expect(result).toEqual({
      ...page,
      items: [expect.objectContaining({ identity: { productId, variantId, sku: variant.sku } })],
    });
    expect(get).toHaveBeenCalledWith(`/products/${productId}/variants`, {
      params: { page: 2, size: 15 },
      signal,
    });
  });
  it("rejects list rows belonging to another Product", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { ...page, items: [{ ...variant, productId: variantId }] },
    });
    await expect(listCanonicalVariants(productId, { page: 2, size: 15 })).rejects.toThrow(
      "không khớp",
    );
  });
  it.each(["DRAFT", "ACTIVE", "BLOCKED", "OBSOLETE"])("parses the confirmed %s enum", (status) => {
    expect(canonicalVariantDtoSchema.parse({ ...variant, status }).status).toBe(status);
  });
  it("rejects unknown enums and missing required fields", () => {
    expect(canonicalVariantDtoSchema.safeParse({ ...variant, status: "Active" }).success).toBe(
      false,
    );
    expect(canonicalVariantDtoSchema.safeParse({ ...variant, variantId: undefined }).success).toBe(
      false,
    );
    expect(
      canonicalVariantDtoSchema.safeParse({ ...variant, attributeSignature: undefined }).success,
    ).toBe(false);
  });
  it("allows omitted obsolete timestamp but rejects explicit null wire fields", () => {
    expect(canonicalVariantDtoSchema.parse(variant)).not.toHaveProperty("obsoletedAt");
    expect(canonicalVariantDtoSchema.safeParse({ ...variant, obsoletedAt: null }).success).toBe(
      false,
    );
    expect(
      canonicalVariantDtoSchema.parse({ ...variant, obsoletedAt: "2026-10-10T00:00:00Z" })
        .obsoletedAt,
    ).toBeDefined();
  });
  it("rejects a page without server pagination metadata", () => {
    expect(canonicalVariantPageSchema.safeParse({ items: [variant] }).success).toBe(false);
  });
});
