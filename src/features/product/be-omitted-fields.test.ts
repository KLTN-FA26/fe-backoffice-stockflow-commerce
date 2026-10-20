/**
 * BE `application.yml` có `default-property-inclusion: non_null`: trường chưa đặt bị bỏ khỏi JSON. Mọi
 * schema response mới phải chấp nhận payload tối thiểu không có các trường nullable.
 */
import { describe, expect, it } from "vitest";

import { beAttributeSchema, beCategoryAttributeSchema } from "./attribute-schemas";
import { beProductAttributesSchema } from "./axes-schemas";
import { beListingSchema, beSkuPriceSchema } from "./listing-schemas";
import {
  discontinuationExtrasSchema,
  openReferencesSchema,
  productVersionPageSchema,
} from "./lifecycle-schemas";
import { productMasterDtoSchema } from "./schemas";
import { beGeneratedVariantsSchema, beVariantSchema } from "./variant-schemas";

describe("response schemas accept BE payloads that omit unset fields", () => {
  it("attribute without unit; value without valueNumber / hexColor", () => {
    const attribute = beAttributeSchema.parse({
      attributeId: "a",
      code: "SIZE",
      name: "Cỡ",
      dataType: "SELECT",
      filterable: true,
      searchable: false,
      sortOrder: 0,
      active: true,
      version: 0,
      values: [{ valueId: "v", code: "S", label: "S", sortOrder: 0, active: true, version: 0 }],
    });
    expect(attribute.unit).toBeUndefined();
    expect(attribute.values[0]?.hexColor).toBeUndefined();
    expect(attribute.values[0]?.valueNumber).toBeUndefined();
  });

  it("category attribute, product axes and descriptives", () => {
    expect(
      beCategoryAttributeSchema.safeParse({
        attributeId: "a",
        attributeCode: "SIZE",
        attributeName: "Cỡ",
        dataType: "SELECT",
        attributeActive: true,
        defaultRole: "DESCRIPTIVE",
        required: false,
        sortOrder: 0,
      }).success,
    ).toBe(true);
    const parsed = beProductAttributesSchema.parse({
      productId: "p",
      axes: [
        {
          attributeId: "a",
          code: "SIZE",
          name: "Cỡ",
          dataType: "SELECT",
          sortOrder: 0,
          options: [{ valueId: "v", code: "S", label: "S", active: true, usedByVariant: false }],
        },
      ],
      descriptives: [
        {
          attributeId: "d",
          code: "ORIGIN",
          name: "Xuất xứ",
          dataType: "TEXT",
          sortOrder: 0,
          values: [],
          text: "VN",
        },
      ],
    });
    expect(parsed.axes[0]?.options[0]?.hexColor).toBeUndefined();
    expect(parsed.descriptives[0]?.number).toBeUndefined();
    expect(parsed.descriptives[0]?.bool).toBeUndefined();
  });

  it("history entry without actor, subject, statuses, reason and changed fields", () => {
    const page = productVersionPageSchema.parse({
      items: [
        {
          action: "CREATE",
          outcome: "SUCCESS",
          occurredAt: "2026-01-01T00:00:00Z",
          changeType: "CREATED",
          subjectType: "PRODUCT",
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });
    expect(page.items[0]?.reason).toBeUndefined();
  });

  it("open references, discontinuation extras, listing, price and generation result", () => {
    expect(openReferencesSchema.parse({ references: [], truncated: false }).references).toEqual([]);
    expect(
      discontinuationExtrasSchema.safeParse({
        warnings: [],
        openReferences: [],
        openReferencesTruncated: false,
      }).success,
    ).toBe(true);
    const listing = beListingSchema.parse({
      productId: "p",
      revision: 0,
      projectedRevision: -1,
      published: false,
      projectionPending: true,
    });
    expect(listing.slug).toBeUndefined();
    const price = beSkuPriceSchema.parse({ sku: "A", revision: 0 });
    expect(price.basePrice).toBeUndefined();
    expect(price.effectivePrice).toBeUndefined();
    expect(beGeneratedVariantsSchema.parse({ created: [], skipped: 0 }).skipped).toBe(0);
  });

  it("variant without signature / obsoletedAt and product without optional dates and reasons", () => {
    const variant = beVariantSchema.parse({
      variantId: "v",
      productId: "p",
      sku: "A",
      name: "A",
      status: "DRAFT",
      defaultVariant: true,
      position: 0,
      version: 0,
    });
    expect(variant.attributeSignature).toBeUndefined();
    expect(variant.options).toEqual([]);
    expect(
      productMasterDtoSchema.safeParse({
        productId: "p",
        code: "A",
        name: "A",
        taxClass: "STANDARD",
        kind: "STANDARD",
        status: "INACTIVE",
        version: 1,
        createdAt: "2026-01-01T00:00:00Z",
      }).success,
    ).toBe(true);
  });
});
