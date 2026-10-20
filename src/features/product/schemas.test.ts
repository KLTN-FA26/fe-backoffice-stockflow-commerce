import { describe, expect, it } from "vitest";

import {
  beProductStatusSchema,
  discontinueProductSchema,
  productDraftFormSchema,
  productMasterDtoSchema,
  productSchema,
  updateProductSchema,
} from "./schemas";
import { variantInputSchema, variantInputSchemaFor } from "./variant-schemas";

describe("product category validation boundaries", () => {
  it("accepts a null category in a loaded product", () => {
    expect(productSchema.shape.categoryId.parse(null)).toBeNull();
  });

  it("still requires a category in the draft form", () => {
    expect(productDraftFormSchema.shape.categoryId.safeParse("").success).toBe(false);
  });
});

const dto = {
  productId: "11111111-1111-4111-8111-111111111111",
  code: "CUP-12",
  name: "Ly",
  taxClass: "STANDARD",
  kind: "STANDARD",
  status: "DRAFT",
  version: 0,
  createdAt: "2026-01-01T00:00:00Z",
};

describe("BE ProductStatus (INACTIVE = tạm ngưng)", () => {
  it.each(["DRAFT", "PENDING_APPROVAL", "APPROVED", "PUBLISHED", "INACTIVE", "DISCONTINUED"])(
    "parses %s",
    (status) => {
      expect(productMasterDtoSchema.parse({ ...dto, status }).status).toBe(status);
    },
  );

  it("an unknown future status becomes UNKNOWN instead of throwing", () => {
    expect(beProductStatusSchema.parse("SOMETHING_NEW")).toBe("UNKNOWN");
    expect(productMasterDtoSchema.parse({ ...dto, status: "SOMETHING_NEW" }).status).toBe(
      "UNKNOWN",
    );
  });

  it("keeps the version (BE long, never null)", () => {
    expect(productMasterDtoSchema.parse({ ...dto, version: 7 }).version).toBe(7);
    expect(productMasterDtoSchema.safeParse({ ...dto, version: undefined }).success).toBe(false);
  });
});

describe("update / discontinue request bodies carry the version", () => {
  const update = {
    name: "Ly",
    nameEn: "Cup",
    categoryId: "cat-1",
    brandId: "brand-1",
    description: "",
    descriptionEn: "",
    taxClass: "STANDARD",
    kind: "STANDARD",
  };

  it("UpdateProductRequest.version is required", () => {
    expect(updateProductSchema.safeParse(update).success).toBe(false);
    expect(updateProductSchema.parse({ ...update, version: 5 }).version).toBe(5);
  });

  it("DiscontinueProductRequest: reason required, ≤ 500 characters, version required", () => {
    expect(discontinueProductSchema.safeParse({ reason: " ", version: 1 }).success).toBe(false);
    expect(
      discontinueProductSchema.safeParse({ reason: "x".repeat(501), version: 1 }).success,
    ).toBe(false);
    expect(discontinueProductSchema.safeParse({ reason: "Hết hàng" }).success).toBe(false);
    expect(discontinueProductSchema.parse({ reason: " Hết hàng ", version: 1 })).toEqual({
      reason: "Hết hàng",
      version: 1,
    });
  });
});

describe("VariantRequest (optionValueIds, không còn attributeSignature)", () => {
  it("sản phẩm không có trục: sku + name bắt buộc, không có tuỳ chọn", () => {
    expect(variantInputSchema.safeParse({ sku: "", name: "x", optionValueIds: [] }).success).toBe(
      false,
    );
    expect(
      variantInputSchema.safeParse({ sku: "CUP_12", name: "", optionValueIds: [] }).success,
    ).toBe(false);
    expect(
      variantInputSchema.safeParse({ sku: "CUP_12", name: "Ly", optionValueIds: [] }).success,
    ).toBe(true);
    expect(
      variantInputSchema.safeParse({ sku: "CUP_12", name: "Ly", optionValueIds: ["v1"] }).success,
    ).toBe(false);
  });

  it("sản phẩm có trục: sku / name tuỳ chọn, bắt buộc đúng một giá trị mỗi trục", () => {
    const schema = variantInputSchemaFor(2);
    expect(schema.safeParse({ sku: "", name: "", optionValueIds: ["a", "b"] }).success).toBe(true);
    expect(schema.safeParse({ sku: "A.B", name: "", optionValueIds: ["a", "b"] }).success).toBe(
      true,
    );
    expect(schema.safeParse({ sku: "", name: "", optionValueIds: ["a"] }).success).toBe(false);
    expect(schema.safeParse({ sku: "-bad", name: "", optionValueIds: ["a", "b"] }).success).toBe(
      false,
    );
  });

  it("không có trường attributeSignature", () => {
    expect(Object.keys(variantInputSchemaFor(1).shape)).toEqual(["sku", "name", "optionValueIds"]);
  });
});
