import { describe, expect, it } from "vitest";

import { productSchema } from "./schemas";
import { productUomLabel } from "./selectors";

describe("Product Master presentation", () => {
  it("shows an explicit unavailable label instead of a fabricated UoM", () => {
    const product = productSchema.parse({
      productId: "11111111-1111-4111-8111-111111111111",
      code: "P-1",
      name: "Product",
      nameEn: "Product",
      type: "Standard",
      categoryId: null,
      status: "Draft",
      description: "",
      descriptionEn: "",
      images: [],
      taxClass: "standard",
      brand: "Brand",
      createdAt: "2026-01-01T00:00:00Z",
      createdBy: "system",
    });

    expect(productUomLabel(product)).toBe("Không có trong Product Master API");
    expect(productUomLabel(product)).not.toBe("pcs");
  });
});
