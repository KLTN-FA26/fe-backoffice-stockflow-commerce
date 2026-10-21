import { beforeEach, describe, expect, it } from "vitest";

import { products, skus } from "@/lib/mock-data";

import {
  ensureAttributeStore,
  mockAxesOf,
  mockDictionary,
  resetAttributeMockStore,
} from "./mock-attribute-store";
import { slugCode } from "./mock-route-utils";

beforeEach(() => resetAttributeMockStore());

describe("mock từ điển thuộc tính — seed suy ra từ mock-data, không bịa", () => {
  it("chỉ gồm thuộc tính mà sản phẩm mẫu khai báo; màu có mã màu, cỡ thì không", async () => {
    const dictionary = await mockDictionary();
    const declared = new Set(products.flatMap((p) => p.attributes.map((a) => a.attributeId)));
    expect(dictionary.map((a) => a.attributeId).sort()).toEqual([...declared].sort());
    const color = dictionary.find((a) => a.attributeId === "ATTR-COLOR");
    expect(color?.dataType).toBe("COLOR");
    for (const value of color?.values ?? []) expect(value.hexColor).toMatch(/^#[0-9A-F]{6}$/);
    expect(dictionary.find((a) => a.attributeId === "ATTR-SIZE")?.dataType).toBe("SELECT");
  });

  it("mã giá trị là A-Z0-9 viết hoa (không dấu), duy nhất trong từng thuộc tính", async () => {
    for (const attribute of await mockDictionary()) {
      const codes = attribute.values.map((v) => v.code);
      expect(new Set(codes).size).toBe(codes.length);
      for (const code of codes) expect(code).toMatch(/^[A-Z0-9][A-Z0-9_-]*$/);
    }
  });

  it("sản phẩm có trục khi mọi SKU mang cùng bộ thuộc tính; mỗi giá trị SKU dùng đều nằm trong trục", async () => {
    await ensureAttributeStore();
    const dictionary = await mockDictionary();
    let withAxes = 0;
    for (const productId of new Set(skus.map((s) => s.productId))) {
      const axes = await mockAxesOf(productId);
      if (axes.length === 0) continue;
      withAxes += 1;
      for (const sku of skus.filter((s) => s.productId === productId)) {
        for (const axis of axes) {
          const attribute = dictionary.find((a) => a.attributeId === axis.attributeId);
          const key = Object.keys(sku.attributes).find(
            (k) => `ATTR-${slugCode(k)}` === axis.attributeId,
          );
          const value = attribute?.values.find(
            (v) => v.code === slugCode(sku.attributes[key ?? ""] ?? ""),
          );
          expect(value, `${sku.skuId} thiếu giá trị trên trục ${axis.attributeId}`).toBeDefined();
          expect(axis.optionValueIds).toContain(value?.valueId);
        }
      }
    }
    expect(withAxes).toBeGreaterThan(0);
  });
});
