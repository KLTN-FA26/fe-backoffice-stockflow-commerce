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

  it("adds the chosen axes to the request in axis order, none when there are no axes", () => {
    const form = {
      productCode: "CUP",
      name: "Ly",
      nameEn: "Cup",
      categoryId: "c",
      brandId: "b",
      taxClass: "STANDARD" as const,
      customizable: false,
      shortDescription: "",
      description: "",
      descriptionEn: "",
    };
    expect(buildCreateProductInput(form)).not.toHaveProperty("axes");
    expect(buildCreateProductInput(form, [])).not.toHaveProperty("axes");
    expect(
      buildCreateProductInput(form, [
        { attributeId: "a-size", optionValueIds: ["v-s", "v-m"] },
        { attributeId: "a-color", optionValueIds: ["v-w"] },
      ]).axes,
    ).toEqual([
      { attributeId: "a-size", sortOrder: 0, optionValueIds: ["v-s", "v-m"] },
      { attributeId: "a-color", sortOrder: 1, optionValueIds: ["v-w"] },
    ]);
  });

  it("without axes a taken SKU means the product code collides with another product's SKU (code field)", () => {
    const result = mapCreateProductError(
      new ApiError(409, "VARIANT_SKU_ALREADY_EXISTS", "SKU CUP already belongs to another product"),
    );
    expect(result.fieldErrors.productCode).toBe(
      "Mã này đã là SKU của một biến thể thuộc sản phẩm khác.",
    );
  });

  it("with axes a refused transaction is explained in Vietnamese and says nothing was created", () => {
    for (const code of [
      "VARIANT_SKU_ALREADY_EXISTS",
      "VARIANT_MATRIX_TOO_LARGE",
      "VARIANT_OPTIONS_INVALID",
      "ATTRIBUTE_NOT_FOUND",
    ]) {
      const result = mapCreateProductError(
        new ApiError(400, code, "English from the server"),
        true,
      );
      expect(result.message).toMatch(/Sản phẩm chưa được tạo\.$/);
      expect(result.message).not.toContain("English from the server");
    }
    const tooLong = mapCreateProductError(
      new ApiError(400, "VALIDATION_FAILED", "The generated SKU is longer"),
      true,
    );
    expect(tooLong.message).toMatch(/quá dài/);
    expect(tooLong.message).toMatch(/chưa được tạo/);
  });
});
