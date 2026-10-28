import { describe, expect, it } from "vitest";

import { categoryName, shouldFlagProductRow, taxClassLabel } from "./selectors";

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

  it("flags products needing attention: waiting for approval, suspended or discontinued", () => {
    const product = (status: Product["status"]) => ({ status }) as Product;
    expect(shouldFlagProductRow(product("Pending Approval"))).toBe(true);
    // Tạm ngưng (BE INACTIVE) đang treo — cần tiếp tục kinh doanh hoặc ngừng hẳn
    expect(shouldFlagProductRow(product("Inactive"))).toBe(true);
    expect(shouldFlagProductRow(product("Discontinued"))).toBe(true);
    expect(shouldFlagProductRow(product("Approved"))).toBe(false);
    expect(shouldFlagProductRow(product("Published"))).toBe(false);
  });

  it("labels the tax class in Vietnamese (BE TaxClass), unknown values shown as-is", () => {
    expect(taxClassLabel("standard")).toBe("Tiêu chuẩn");
    expect(taxClassLabel("REDUCED")).toBe("Giảm thuế");
    expect(taxClassLabel("exempt")).toBe("Miễn thuế");
    expect(taxClassLabel("LUXURY")).toBe("LUXURY");
  });
});
