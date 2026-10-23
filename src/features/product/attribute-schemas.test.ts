import { describe, expect, it } from "vitest";

import {
  attributeFormSchema,
  attributeValueFormSchemaFor,
  beAttributeSchema,
  canBeVariantAxis,
  holdsValues,
  replaceCategoryAttributesSchema,
} from "./attribute-schemas";

import type { AttributeDataType } from "./attribute-schemas";

const form = {
  code: "COLOR",
  dataType: "COLOR" as const,
  name: "Màu sắc",
  unit: "",
  filterable: true,
  searchable: false,
  sortOrder: "",
  active: true,
};
const ALL_TYPES: AttributeDataType[] = [
  "TEXT",
  "NUMBER",
  "BOOLEAN",
  "SELECT",
  "MULTISELECT",
  "COLOR",
];

describe("attribute form (BE CreateAttributeRequest / Attribute.normaliseCode)", () => {
  it("accepts a code that the backend would upper-case; refuses '-', spaces and a leading '_'", () => {
    expect(attributeFormSchema.safeParse({ ...form, code: "color_2" }).success).toBe(true);
    for (const code of ["", "co lor", "COLOR-X", "_COLOR", "A".repeat(51)]) {
      expect(attributeFormSchema.safeParse({ ...form, code }).success).toBe(false);
    }
  });

  it("name is required (≤ 255) and unit is at most 20 characters", () => {
    expect(attributeFormSchema.safeParse({ ...form, name: "  " }).success).toBe(false);
    expect(attributeFormSchema.safeParse({ ...form, name: "x".repeat(256) }).success).toBe(false);
    expect(attributeFormSchema.safeParse({ ...form, unit: "x".repeat(21) }).success).toBe(false);
    expect(attributeFormSchema.safeParse({ ...form, unit: "x".repeat(20) }).success).toBe(true);
  });

  it("sort order is blank (BE default 0) or an integer", () => {
    expect(attributeFormSchema.safeParse({ ...form, sortOrder: "3" }).success).toBe(true);
    expect(attributeFormSchema.safeParse({ ...form, sortOrder: "1.5" }).success).toBe(false);
  });
});

describe("attribute value form (BE Attribute.requireShape)", () => {
  const value = {
    code: "RED",
    label: "Đỏ",
    valueNumber: "",
    hexColor: "#ff0000",
    sortOrder: "",
    active: true,
  };

  it("a COLOR value needs #RRGGBB; other types must not carry a colour", () => {
    const color = attributeValueFormSchemaFor("COLOR");
    expect(color.safeParse(value).success).toBe(true);
    expect(color.safeParse({ ...value, hexColor: "" }).success).toBe(false);
    expect(color.safeParse({ ...value, hexColor: "red" }).success).toBe(false);
    expect(color.safeParse({ ...value, hexColor: "#ff00" }).success).toBe(false);
    const select = attributeValueFormSchemaFor("SELECT");
    expect(select.safeParse({ ...value, hexColor: "" }).success).toBe(true);
    expect(select.safeParse(value).success).toBe(false);
  });

  it("value code allows '-' (12OZ-HOT) but not a leading separator", () => {
    const select = attributeValueFormSchemaFor("SELECT");
    expect(select.safeParse({ ...value, hexColor: "", code: "12OZ-HOT" }).success).toBe(true);
    expect(select.safeParse({ ...value, hexColor: "", code: "-X" }).success).toBe(false);
  });

  it("valueNumber allows 14 integer and 4 fraction digits", () => {
    const select = attributeValueFormSchemaFor("SELECT");
    const ok = (valueNumber: string) =>
      select.safeParse({ ...value, hexColor: "", valueNumber }).success;
    expect(ok("12.5")).toBe(true);
    expect(ok("12345678901234.1234")).toBe(true);
    expect(ok("123456789012345")).toBe(false);
    expect(ok("1.12345")).toBe(false);
    expect(ok("abc")).toBe(false);
  });
});

describe("attribute data types (BE AttributeDataType)", () => {
  it("only SELECT / MULTISELECT / COLOR hold values; only SELECT / COLOR can be an axis", () => {
    expect(ALL_TYPES.filter(holdsValues)).toEqual(["SELECT", "MULTISELECT", "COLOR"]);
    expect(ALL_TYPES.filter(canBeVariantAxis)).toEqual(["SELECT", "COLOR"]);
  });
});

describe("AttributeResponse DTO", () => {
  const dto = {
    attributeId: "a1",
    code: "COLOR",
    name: "Màu",
    dataType: "COLOR",
    unit: null,
    filterable: true,
    searchable: false,
    sortOrder: 0,
    active: true,
    version: 2,
    values: [
      {
        valueId: "v1",
        code: "RED",
        label: "Đỏ",
        valueNumber: "1.5",
        hexColor: "#FF0000",
        sortOrder: 0,
        active: true,
        version: 0,
      },
    ],
  };

  it("parses BigDecimal valueNumber sent as number or string", () => {
    expect(beAttributeSchema.parse(dto).values[0]?.valueNumber).toBe(1.5);
    const asNumber = { ...dto, values: [{ ...dto.values[0], valueNumber: 2 }] };
    expect(beAttributeSchema.parse(asNumber).values[0]?.valueNumber).toBe(2);
  });

  it("rejects an unknown data type instead of guessing", () => {
    expect(beAttributeSchema.safeParse({ ...dto, dataType: "RANGE" }).success).toBe(false);
  });
});

describe("category attribute set (BE ReplaceCategoryAttributesRequest)", () => {
  const entry = (
    attributeId: string,
    defaultRole: "VARIANT_AXIS" | "DESCRIPTIVE" = "DESCRIPTIVE",
  ) => ({ attributeId, defaultRole, required: false, sortOrder: 0 });

  it("is the whole set: an empty list is valid (clears the set)", () => {
    expect(replaceCategoryAttributesSchema.safeParse({ attributes: [] }).success).toBe(true);
  });

  it("lists each attribute once", () => {
    expect(
      replaceCategoryAttributesSchema.safeParse({ attributes: [entry("a"), entry("b")] }).success,
    ).toBe(true);
    expect(
      replaceCategoryAttributesSchema.safeParse({
        attributes: [entry("a"), entry("a", "VARIANT_AXIS")],
      }).success,
    ).toBe(false);
  });
});
