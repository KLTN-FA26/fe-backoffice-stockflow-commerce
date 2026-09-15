import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api";

import { buildCreateProductInput, mapCreateProductError } from "./create-product-form";

import type { ProductAttribute } from "./types";

const colorAttribute: ProductAttribute = {
  attributeId: "ATTR-COLOR",
  name: { vi: "Màu sắc", en: "Color" },
  values: ["Đen", "Trắng"],
};

describe("create product form helpers", () => {
  it("maps the wizard snapshot to the create Product API input", () => {
    const input = buildCreateProductInput(
      {
        productCode: "PRD-NEW",
        name: "Áo mới",
        nameEn: "",
        type: "Standard",
        categoryId: "CAT-01",
        brand: "StockFlow",
        taxClass: "standard",
        uom: "pcs",
        description: "Mô tả",
        descriptionEn: "",
        imageUrls: "/mock/img/new-1.jpg\n/mock/img/new-2.jpg",
        model3dUrl: "",
        printAreas: [],
        allowedTechniques: ["DTG"],
      },
      [{ attr: colorAttribute, values: ["Đen"] }],
    );

    expect(input).toMatchObject({
      productId: "PRD-NEW",
      name: "Áo mới",
      nameEn: "Áo mới",
      categoryId: "CAT-01",
      brand: "StockFlow",
      images: ["/mock/img/new-1.jpg", "/mock/img/new-2.jpg"],
      attributes: [{ attributeId: "ATTR-COLOR", values: ["Đen"] }],
    });
  });

  it("maps backend code and category errors to visible form fields", () => {
    const duplicate = mapCreateProductError(
      new ApiError(409, "PRODUCT_CODE_ALREADY_EXISTS", "Trùng mã", { code: "Mã đã tồn tại" }),
    );
    const staleCategory = mapCreateProductError(
      new ApiError(404, "CATEGORY_NOT_FOUND", "Danh mục không tồn tại"),
    );

    expect(duplicate.fieldErrors.productCode).toBe("Mã đã tồn tại");
    expect(staleCategory.fieldErrors.categoryId).toBe(
      "Danh mục đã bị xoá hoặc không còn khả dụng.",
    );
  });
});
