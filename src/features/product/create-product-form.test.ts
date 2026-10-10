import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api";

import { buildCreateProductInput, mapCreateProductError } from "./create-product-form";

describe("create product form helpers", () => {
  it("maps the form to the backend CreateProductRequest", () => {
    const input = buildCreateProductInput({
      productCode: "PRD-NEW",
      name: "Áo mới",
      nameEn: "New shirt",
      categoryId: "c5ad8d15-e378-4ea7-8c75-b5c012508ced",
      brandId: "0b6a2f4e-9a43-4c55-8f0e-0c1c6e8c1b11",
      taxClass: "STANDARD",
      customizable: true,
      shortDescription: "  Áo thun in  ",
      description: "Mô tả",
      descriptionEn: "Description",
    });

    expect(input).toEqual({
      code: "PRD-NEW",
      name: "Áo mới",
      nameEn: "New shirt",
      categoryId: "c5ad8d15-e378-4ea7-8c75-b5c012508ced",
      brandId: "0b6a2f4e-9a43-4c55-8f0e-0c1c6e8c1b11",
      shortDescription: "Áo thun in",
      description: "Mô tả",
      descriptionEn: "Description",
      taxClass: "STANDARD",
      kind: "CUSTOMIZABLE",
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

  it("maps a stale brand (BE 404 BRAND_NOT_FOUND) to the brand field", () => {
    const result = mapCreateProductError(new ApiError(404, "BRAND_NOT_FOUND", "Brand not found"));
    expect(result.fieldErrors.brandId).toBe("Thương hiệu đã bị xoá hoặc không còn khả dụng.");
  });

  it("localizes recognized validation fields without branching on translated messages", () => {
    const result = mapCreateProductError(
      new ApiError(400, "VALIDATION_FAILED", "Validation failed", {
        name: "must not be blank",
        brandId: "ne doit pas être vide",
      }),
    );

    expect(result.fieldErrors).toMatchObject({
      name: "Tên sản phẩm không hợp lệ.",
      brandId: "Thương hiệu không hợp lệ.",
    });
  });
});
