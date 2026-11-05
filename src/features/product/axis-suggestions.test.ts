import { describe, expect, it } from "vitest";

import { requiredAxisDrafts, suggestedAxes } from "./axis-suggestions";

import type { CategoryAttribute } from "./attribute-schemas";

const row = (patch: Partial<CategoryAttribute>): CategoryAttribute => ({
  attributeId: "a",
  attributeCode: "A",
  attributeName: "A",
  dataType: "SELECT",
  attributeActive: true,
  defaultRole: "VARIANT_AXIS",
  required: false,
  sortOrder: 0,
  ...patch,
});

describe("axis-suggestions — bộ thuộc tính của danh mục → trục form tạo (spec D9)", () => {
  const rows = [
    row({ attributeId: "color", dataType: "COLOR", sortOrder: 2 }),
    row({ attributeId: "size", required: true, sortOrder: 1 }),
    row({ attributeId: "material", defaultRole: "DESCRIPTIVE", required: true }),
    row({ attributeId: "tags", dataType: "MULTISELECT" }),
    row({ attributeId: "old", attributeActive: false, required: true }),
  ];

  it("chỉ thuộc tính vai trò trục, còn dùng, kiểu SELECT / COLOR — theo thứ tự của danh mục", () => {
    expect(suggestedAxes(rows).map((r) => r.attributeId)).toEqual(["size", "color"]);
  });

  it("điền sẵn chỉ trục bắt buộc, chưa chọn giá trị", () => {
    expect(requiredAxisDrafts(rows)).toEqual([{ attributeId: "size", optionValueIds: [] }]);
  });

  it("danh mục không có gợi ý → không điền gì", () => {
    expect(requiredAxisDrafts([])).toEqual([]);
    expect(suggestedAxes([])).toEqual([]);
  });
});
