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
      brand: "StockFlow",
      taxClass: "STANDARD",
      customizable: false,
      description: "Mô tả",
      descriptionEn: "Description",
      imageUrls: "/mock/img/new-1.jpg\n/mock/img/new-2.jpg",
      weightKg: "0.5",
      lengthCm: "",
      widthCm: "20",
      heightCm: "10",
    });

    expect(input).toMatchObject({
      code: "PRD-NEW",
      name: "Áo mới",
      nameEn: "New shirt",
      brand: "StockFlow",
      images: ["/mock/img/new-1.jpg", "/mock/img/new-2.jpg"],
      weightKg: 0.5,
      lengthCm: null,
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

  it("maps backend logistics and image errors to their form fields", () => {
    const result = mapCreateProductError(
      new ApiError(400, "VALIDATION_FAILED", "Dữ liệu không hợp lệ", {
        images: "URL ảnh không hợp lệ",
        weightKg: "Khối lượng phải lớn hơn 0",
      }),
    );

    expect(result.fieldErrors).toMatchObject({
      imageUrls: "URL ảnh không hợp lệ",
      weightKg: "Khối lượng phải lớn hơn 0",
    });
  });
});
