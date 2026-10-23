import { describe, expect, it } from "vitest";

import { axesDraftIssue, previewGeneration, previewMatrix, toAxisInputs } from "./axes-draft";

import type { Attribute } from "./attribute-schemas";

const value = (code: string, label: string, sortOrder: number, active = true) => ({
  valueId: `v-${code}`,
  code,
  label,
  valueNumber: null,
  hexColor: null,
  sortOrder,
  active,
  version: 0,
});
const attribute = (
  attributeId: string,
  code: string,
  values: ReturnType<typeof value>[],
): Attribute => ({
  attributeId,
  code,
  name: code,
  dataType: "SELECT",
  unit: null,
  filterable: true,
  searchable: false,
  sortOrder: 0,
  active: true,
  version: 0,
  values,
});
const color = attribute("a-color", "COLOR", [value("WHT", "Trắng", 0), value("BLK", "Đen", 1)]);
const size = attribute("a-size", "SIZE", [
  value("S", "S", 0),
  value("M", "M", 1),
  value("L", "L", 2),
]);

describe("axes draft", () => {
  it("reports the first axis without an attribute or option", () => {
    expect(axesDraftIssue([])).toBeNull();
    expect(axesDraftIssue([{ attributeId: "", optionValueIds: [] }])).toMatch(
      /Trục 1: chọn thuộc tính/,
    );
    expect(axesDraftIssue([{ attributeId: "a-color", optionValueIds: [] }])).toMatch(
      /ít nhất một giá trị/,
    );
    expect(axesDraftIssue([{ attributeId: "a-color", optionValueIds: ["v-WHT"] }])).toBeNull();
  });

  it("turns drafts into AxisInput with the list position as sortOrder", () => {
    expect(
      toAxisInputs([
        { attributeId: "a-size", optionValueIds: ["v-S"] },
        { attributeId: "a-color", optionValueIds: ["v-WHT", "v-BLK"] },
      ]),
    ).toEqual([
      { attributeId: "a-size", sortOrder: 0, optionValueIds: ["v-S"] },
      { attributeId: "a-color", sortOrder: 1, optionValueIds: ["v-WHT", "v-BLK"] },
    ]);
  });
});

describe("previewMatrix (tạo sản phẩm kèm trục)", () => {
  const drafts = [
    { attributeId: "a-color", optionValueIds: ["v-BLK", "v-WHT"] },
    { attributeId: "a-size", optionValueIds: ["v-S", "v-M", "v-L"] },
  ];

  it("counts every combination and previews SKUs in axis order with dictionary-ordered values", () => {
    const preview = previewMatrix(drafts, [color, size], "cup");
    expect(preview.total).toBe(6);
    expect(preview.overCap).toBe(false);
    expect(preview.samples.slice(0, 3)).toEqual([
      { sku: "CUP-WHT-S", label: "Trắng / S", tooLong: false },
      { sku: "CUP-WHT-M", label: "Trắng / M", tooLong: false },
      { sku: "CUP-WHT-L", label: "Trắng / L", tooLong: false },
    ]);
  });

  it("ignores inactive values (BE generates only active options)", () => {
    const retired = attribute("a-size", "SIZE", [value("S", "S", 0), value("M", "M", 1, false)]);
    expect(previewMatrix(drafts, [color, retired], "CUP").total).toBe(2);
  });

  it("flags more than 100 combinations and SKUs over 64 characters", () => {
    const many = attribute(
      "a-big",
      "BIG",
      Array.from({ length: 11 }, (_, i) => value(`V${i}`, `V${i}`, i)),
    );
    const ten = attribute(
      "a-ten",
      "TEN",
      Array.from({ length: 10 }, (_, i) => value(`T${i}`, `T${i}`, i)),
    );
    const over = previewMatrix(
      [
        { attributeId: "a-big", optionValueIds: many.values.map((v) => v.valueId) },
        { attributeId: "a-ten", optionValueIds: ten.values.map((v) => v.valueId) },
      ],
      [many, ten],
      "X",
    );
    expect(over.total).toBe(110);
    expect(over.overCap).toBe(true);
    const long = previewMatrix(drafts, [color, size], "P".repeat(62));
    expect(long.anyTooLong).toBe(true);
    expect(long.samples[0]?.tooLong).toBe(true);
  });

  it("is empty with no axis", () => {
    expect(previewMatrix([], [color], "CUP")).toMatchObject({
      total: 0,
      overCap: false,
      samples: [],
    });
  });
});

describe("previewGeneration (sinh tổ hợp cho sản phẩm đã có trục)", () => {
  const axes = [
    {
      attributeId: "a-color",
      options: color.values.map((v) => ({
        valueId: v.valueId,
        code: v.code,
        label: v.label,
        active: v.active,
      })),
    },
    {
      attributeId: "a-size",
      options: size.values.map((v) => ({
        valueId: v.valueId,
        code: v.code,
        label: v.label,
        active: v.active,
      })),
    },
  ];
  const all = new Map([
    ["a-color", new Set(["v-WHT", "v-BLK"])],
    ["a-size", new Set(["v-S", "v-M", "v-L"])],
  ]);

  it("existing combinations are skipped by value set, not by order", () => {
    const existing = new Set(["v-S|v-WHT", "v-BLK|v-L"]);
    const preview = previewGeneration(axes, all, existing, "CUP");
    expect(preview).toMatchObject({ total: 6, existing: 2, toCreate: 4, overCap: false });
    expect(preview.samples.map((s) => s.sku)).not.toContain("CUP-WHT-S");
  });

  it("a restricted selection shrinks the matrix; an empty axis makes it 0", () => {
    const restricted = new Map([...all, ["a-size", new Set(["v-S"])]]);
    expect(previewGeneration(axes, restricted, new Set(), "CUP")).toMatchObject({
      total: 2,
      toCreate: 2,
    });
    const empty = new Map([...all, ["a-size", new Set<string>()]]);
    expect(previewGeneration(axes, empty, new Set(), "CUP")).toMatchObject({
      total: 0,
      toCreate: 0,
    });
  });

  it("is over the cap only when the combinations still to create exceed 100", () => {
    const big = Array.from({ length: 11 }, (_, i) => ({
      valueId: `b${i}`,
      code: `B${i}`,
      label: `B${i}`,
      active: true,
    }));
    const ten = Array.from({ length: 10 }, (_, i) => ({
      valueId: `t${i}`,
      code: `T${i}`,
      label: `T${i}`,
      active: true,
    }));
    const wide = [
      { attributeId: "big", options: big },
      { attributeId: "ten", options: ten },
    ];
    const selection = new Map([
      ["big", new Set(big.map((o) => o.valueId))],
      ["ten", new Set(ten.map((o) => o.valueId))],
    ]);
    expect(previewGeneration(wide, selection, new Set(), "X")).toMatchObject({
      total: 110,
      toCreate: 110,
      overCap: true,
    });
    // 12 đã có → còn 98 tổ hợp cần tạo: nằm trong giới hạn.
    const existing = new Set(
      big
        .slice(0, 1)
        .flatMap((b) => ten.map((t) => [b.valueId, t.valueId].sort().join("|")))
        .concat(["b1|t0", "b1|t1"]),
    );
    expect(previewGeneration(wide, selection, existing, "X")).toMatchObject({
      existing: 12,
      toCreate: 98,
      overCap: false,
    });
  });

  it("biến thể mặc định chưa gán nhận tổ hợp đầu tiên và giữ SKU của nó (= mã sản phẩm), không sinh SKU theo quy tắc", () => {
    const preview = previewGeneration(axes, all, new Set(), "CUP", "CUP");
    expect(preview.usesDefault).toBe(true);
    expect(preview.samples[0]).toEqual({ sku: "CUP", label: "Trắng / S", keptDefault: true });
    expect(preview.samples[1]).toMatchObject({ sku: "CUP-WHT-M", keptDefault: false });
    // Vẫn tính vào số tổ hợp còn thiếu (giới hạn 100).
    expect(preview.toCreate).toBe(6);
  });

  it("tổ hợp đầu tiên là của ma trận đầy đủ: bỏ chọn giá trị đầu thì biến thể mặc định không nhận gì", () => {
    const withoutFirst = new Map([...all, ["a-color", new Set(["v-BLK"])]]);
    const preview = previewGeneration(axes, withoutFirst, new Set(), "CUP", "CUP");
    expect(preview.usesDefault).toBe(false);
    expect(preview.samples.every((s) => !s.keptDefault)).toBe(true);
  });

  it("không có biến thể mặc định chưa gán thì không đổi SKU nào", () => {
    expect(previewGeneration(axes, all, new Set(), "CUP").usesDefault).toBe(false);
  });

  it("quá lớn để liệt kê: giới hạn tính trên số CÒN THIẾU (tổng − đã có), như BE requireWithinCap", () => {
    const options = (prefix: string, n: number) =>
      Array.from({ length: n }, (_, i) => ({
        valueId: `${prefix}${i}`,
        code: `${prefix}${i}`,
        label: `${prefix}${i}`,
        active: true,
      }));
    const wide = [
      { attributeId: "x", options: options("x", 30) },
      { attributeId: "y", options: options("y", 20) },
    ];
    const selection = new Map(
      wide.map((a) => [a.attributeId, new Set(a.options.map((o) => o.valueId))]),
    );
    // 600 tổ hợp, không có biến thể nào → chắc chắn quá giới hạn.
    expect(previewGeneration(wide, selection, new Set(), "P")).toMatchObject({
      total: 600,
      toCreate: 600,
      overCap: true,
    });
    // 600 − 500 đã có = 100 → còn nằm trong giới hạn dù tổng lớn.
    const existing = new Set(Array.from({ length: 500 }, (_, i) => `e${i}`));
    expect(previewGeneration(wide, selection, existing, "P")).toMatchObject({
      toCreate: 100,
      overCap: false,
    });
    const fewer = new Set(Array.from({ length: 499 }, (_, i) => `e${i}`));
    expect(previewGeneration(wide, selection, fewer, "P")).toMatchObject({
      toCreate: 101,
      overCap: true,
    });
  });
});
