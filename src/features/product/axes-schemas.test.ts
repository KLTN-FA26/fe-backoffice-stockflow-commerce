import { describe, expect, it } from "vitest";

import {
  MATRIX_MAX_PER_CALL,
  axisInputSchema,
  beProductAttributesSchema,
  descriptiveEntryFromDraft,
  enumerateCombinations,
  generatedSku,
  generatedSkuTooLong,
  matrixSize,
  replaceAxesSchema,
  replaceDescriptivesSchema,
} from "./axes-schemas";

import type { DescriptiveDraft } from "./axes-schemas";

describe("axes (BE ReplaceAxesRequest)", () => {
  it("an axis needs a attribute and at least one distinct option (BE @NotEmpty)", () => {
    expect(axisInputSchema.safeParse({ attributeId: "a", optionValueIds: ["v1"] }).success).toBe(
      true,
    );
    expect(axisInputSchema.safeParse({ attributeId: "a", optionValueIds: [] }).success).toBe(false);
    expect(axisInputSchema.safeParse({ attributeId: "", optionValueIds: ["v1"] }).success).toBe(
      false,
    );
    expect(
      axisInputSchema.safeParse({ attributeId: "a", optionValueIds: ["v1", "v1"] }).success,
    ).toBe(false);
  });

  it("an attribute is an axis once; an empty list is valid (no axes)", () => {
    const axis = (attributeId: string) => ({ attributeId, optionValueIds: ["v"] });
    expect(replaceAxesSchema.safeParse({ axes: [] }).success).toBe(true);
    expect(replaceAxesSchema.safeParse({ axes: [axis("a"), axis("b")] }).success).toBe(true);
    expect(replaceAxesSchema.safeParse({ axes: [axis("a"), axis("a")] }).success).toBe(false);
  });
});

describe("descriptive attributes (BE ProductAttributeSet.values)", () => {
  const draft = (over: Partial<DescriptiveDraft>): DescriptiveDraft => ({
    attributeId: "a",
    dataType: "TEXT",
    valueIds: [],
    text: "",
    number: "",
    bool: null,
    ...over,
  });

  it("SELECT and COLOR take exactly one dictionary value; MULTISELECT at least one", () => {
    for (const dataType of ["SELECT", "COLOR"] as const) {
      expect(descriptiveEntryFromDraft(draft({ dataType, valueIds: ["v1"] }), 2)).toEqual({
        entry: { attributeId: "a", sortOrder: 2, valueIds: ["v1"] },
      });
      expect(descriptiveEntryFromDraft(draft({ dataType, valueIds: [] }), 0)).toHaveProperty(
        "error",
      );
      expect(
        descriptiveEntryFromDraft(draft({ dataType, valueIds: ["v1", "v2"] }), 0),
      ).toHaveProperty("error");
    }
    expect(
      descriptiveEntryFromDraft(draft({ dataType: "MULTISELECT", valueIds: ["v1", "v2"] }), 0),
    ).toHaveProperty("entry");
    expect(descriptiveEntryFromDraft(draft({ dataType: "MULTISELECT" }), 0)).toHaveProperty(
      "error",
    );
  });

  it("TEXT needs non-blank text (trimmed, ≤ 2000)", () => {
    expect(descriptiveEntryFromDraft(draft({ text: "  Cotton  " }), 0)).toEqual({
      entry: { attributeId: "a", sortOrder: 0, text: "Cotton" },
    });
    expect(descriptiveEntryFromDraft(draft({ text: "   " }), 0)).toHaveProperty("error");
    expect(descriptiveEntryFromDraft(draft({ text: "x".repeat(2001) }), 0)).toHaveProperty("error");
  });

  it("NUMBER needs a number with at most 14 integer and 4 fraction digits", () => {
    const number = (raw: string) =>
      descriptiveEntryFromDraft(draft({ dataType: "NUMBER", number: raw }), 0);
    expect(number("12.5")).toEqual({ entry: { attributeId: "a", sortOrder: 0, number: 12.5 } });
    expect(number("0")).toHaveProperty("entry");
    expect(number("")).toHaveProperty("error");
    expect(number("abc")).toHaveProperty("error");
    expect(number("1.23456")).toHaveProperty("error");
  });

  it("BOOLEAN needs an explicit true / false (false is a valid answer)", () => {
    expect(descriptiveEntryFromDraft(draft({ dataType: "BOOLEAN", bool: false }), 0)).toEqual({
      entry: { attributeId: "a", sortOrder: 0, bool: false },
    });
    expect(descriptiveEntryFromDraft(draft({ dataType: "BOOLEAN", bool: null }), 0)).toHaveProperty(
      "error",
    );
  });

  it("the whole list lists each attribute once", () => {
    const entry = (attributeId: string) => ({ attributeId, text: "x" });
    expect(
      replaceDescriptivesSchema.safeParse({ attributes: [entry("a"), entry("b")] }).success,
    ).toBe(true);
    expect(
      replaceDescriptivesSchema.safeParse({ attributes: [entry("a"), entry("a")] }).success,
    ).toBe(false);
  });
});

describe("variant matrix helpers (BE VariantMatrix, SkuCodeRule)", () => {
  it("size is the product of the axis sizes; no axis or an empty axis is 0", () => {
    expect(matrixSize([4, 5])).toBe(20);
    expect(matrixSize([3])).toBe(3);
    expect(matrixSize([])).toBe(0);
    expect(matrixSize([3, 0])).toBe(0);
    expect(
      matrixSize([
        100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
        100, 100,
      ]),
    ).toBe(Number.MAX_SAFE_INTEGER);
    expect(MATRIX_MAX_PER_CALL).toBe(100);
  });

  it("SKU is PRODUCT_CODE-VALUE-VALUE in axis order, product code upper-cased", () => {
    expect(generatedSku("cup-12oz", ["WHT", "L"])).toBe("CUP-12OZ-WHT-L");
    expect(generatedSku("CUP", [])).toBe("CUP");
  });

  it("flags a generated SKU longer than the 64-character BE limit", () => {
    expect(generatedSkuTooLong("A".repeat(64))).toBe(false);
    expect(generatedSkuTooLong("A".repeat(65))).toBe(true);
  });

  it("enumerates combinations with the first axis varying slowest (BE VariantMatrix.of)", () => {
    expect(
      enumerateCombinations([
        ["a", "b"],
        ["1", "2", "3"],
      ]),
    ).toEqual([
      ["a", "1"],
      ["a", "2"],
      ["a", "3"],
      ["b", "1"],
      ["b", "2"],
      ["b", "3"],
    ]);
    expect(enumerateCombinations([])).toEqual([]);
  });
});

describe("ProductAttributesResponse DTO", () => {
  const dto = {
    productId: "p",
    axes: [
      {
        attributeId: "a",
        code: "COLOR",
        name: "Màu",
        dataType: "COLOR",
        sortOrder: 0,
        options: [
          {
            valueId: "v",
            code: "RED",
            label: "Đỏ",
            hexColor: "#FF0000",
            valueNumber: null,
            active: true,
            usedByVariant: false,
          },
        ],
      },
    ],
    descriptives: [
      {
        attributeId: "d",
        code: "WEIGHT",
        name: "Nặng",
        dataType: "NUMBER",
        unit: "kg",
        sortOrder: 0,
        values: [],
        text: null,
        number: "1.50",
        bool: null,
      },
    ],
  };

  it("parses axes with usedByVariant and descriptive scalar values (BigDecimal as string)", () => {
    const parsed = beProductAttributesSchema.parse(dto);
    expect(parsed.axes[0]?.options[0]?.usedByVariant).toBe(false);
    expect(parsed.descriptives[0]?.number).toBe(1.5);
  });

  it("requires usedByVariant: the BE always sends it and the editor relies on it to lock options", () => {
    const missing = {
      ...dto,
      axes: [{ ...dto.axes[0], options: [{ valueId: "v", code: "R", label: "R", active: true }] }],
    };
    expect(beProductAttributesSchema.safeParse(missing).success).toBe(false);
  });
});
