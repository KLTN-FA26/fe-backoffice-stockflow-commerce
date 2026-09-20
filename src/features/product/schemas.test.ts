import { describe, expect, it } from "vitest";

import { productDraftFormSchema, productSchema } from "./schemas";

describe("product category validation boundaries", () => {
  it("accepts a null category in a loaded product", () => {
    expect(productSchema.shape.categoryId.parse(null)).toBeNull();
  });

  it("still requires a category in the draft form", () => {
    expect(productDraftFormSchema.shape.categoryId.safeParse("").success).toBe(false);
  });
});
