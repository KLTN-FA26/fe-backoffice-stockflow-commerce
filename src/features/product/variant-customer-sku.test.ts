import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { listVariants } from "./variant-api";
import { beVariantSchema, isCustomerOwnedSku } from "./variant-schemas";

afterEach(() => vi.restoreAllMocks());

const row = (i: number, over: Record<string, unknown> = {}) => ({
  variantId: `v-${i}`,
  productId: "p",
  sku: `CUP-${String(i).padStart(4, "0")}`,
  name: `CUP ${i}`,
  status: "ACTIVE",
  defaultVariant: i === 0,
  position: i,
  version: 0,
  options: [],
  ...over,
});

describe("isCustomerOwnedSku (BE CustomerSkuService: attributeSignature = OWNED-SKU:<sku>)", () => {
  it("chỉ biến thể mang chữ ký OWNED-SKU: là SKU riêng của khách", () => {
    expect(
      isCustomerOwnedSku(
        beVariantSchema.parse(row(1, { attributeSignature: "OWNED-SKU:CUP-0001" })),
      ),
    ).toBe(true);
    expect(
      isCustomerOwnedSku(beVariantSchema.parse(row(2, { attributeSignature: "SIZE=12OZ" }))),
    ).toBe(false);
    expect(isCustomerOwnedSku(beVariantSchema.parse(row(3)))).toBe(false);
  });
});

describe("listVariants — đọc hết các trang (SKU riêng có thể vượt 200)", () => {
  it("gọi tiếp trang sau khi BE báo hasNext, gộp và sắp theo vị trí", async () => {
    const get = vi.spyOn(api, "get").mockImplementation(async (_url, config) => {
      const page = (config?.params as { page: number }).page;
      return {
        data:
          page === 0
            ? { items: [row(1), row(0)], hasNext: true }
            : { items: [row(2, { attributeSignature: "OWNED-SKU:CUP-0002" })], hasNext: false },
      };
    });
    const variants = await listVariants("p");
    expect(get).toHaveBeenCalledTimes(2);
    expect(variants.map((v) => v.variantId)).toEqual(["v-0", "v-1", "v-2"]);
  });
});
