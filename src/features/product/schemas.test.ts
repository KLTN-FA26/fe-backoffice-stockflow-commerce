import { describe, expect, it } from "vitest";

import { productDraftFormSchema, productSchema } from "./schemas";
import { productUnitLabel } from "./selectors";

describe("product category validation boundaries", () => {
  it("accepts a null category in a loaded product", () => {
    expect(productSchema.shape.categoryId.parse(null)).toBeNull();
  });

  it("still requires a category in the draft form", () => {
    expect(productDraftFormSchema.shape.categoryId.safeParse("").success).toBe(false);
  });

  it("distinguishes unsupported legacy fields from genuinely empty attributes", () => {
    expect(productSchema.shape.basePrice.parse(undefined)).toBeUndefined();
    expect(productSchema.shape.uom.parse(undefined)).toBeUndefined();
    expect(productSchema.shape.attributes.parse(undefined)).toBeUndefined();
    expect(productSchema.shape.attributes.parse([])).toEqual([]);
  });

  it("renders an explicit label instead of a fabricated UoM", () => {
    expect(productUnitLabel(undefined)).toBe("Chưa được backend cung cấp");
    expect(productUnitLabel("pcs")).toBe("pcs");
  });
});
