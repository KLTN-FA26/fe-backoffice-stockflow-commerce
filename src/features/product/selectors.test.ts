import { describe, expect, it } from "vitest";

import { categoryName, shouldFlagProductRow } from "./selectors";

import type { Category, Product } from "./types";

const categories: Category[] = [
  {
    categoryId: "c-1",
    name: { vi: "Ly giấy", en: "Paper cups" },
    parentId: null,
    level: 1,
    slug: "ly",
  },
];

describe("Product Master presentation", () => {
  it("names the category, or says none is chosen — never a raw id", () => {
    expect(categoryName("c-1", categories)).toBe("Ly giấy");
    expect(categoryName(null, categories)).toBe("Chưa chọn danh mục");
    expect(categoryName("c-404", categories)).toBe("—");
  });

  it("flags products waiting for approval or discontinued", () => {
    const product = (status: Product["status"]) => ({ status }) as Product;
    expect(shouldFlagProductRow(product("Pending Approval"))).toBe(true);
    expect(shouldFlagProductRow(product("Discontinued"))).toBe(true);
    expect(shouldFlagProductRow(product("Approved"))).toBe(false);
  });
});
