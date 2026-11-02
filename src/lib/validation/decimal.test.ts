import { describe, expect, it } from "vitest";

import { canonicalDecimal, DECIMAL_TEXT, travelsExactly } from "./decimal";

describe("decimal (tiền BigDecimal dạng chuỗi)", () => {
  it.each([
    ["007.50", "7.5"],
    ["100.00", "100"],
    ["0", "0"],
  ])("canonicalDecimal(%s) = %s", (raw, expected) => expect(canonicalDecimal(raw)).toBe(expected));

  it("chỉ chữ số thập phân không dấu, không số mũ", () => {
    for (const ok of ["1", "1.5", "0012"]) expect(DECIMAL_TEXT.test(ok)).toBe(true);
    for (const bad of ["-1", "1e3", "1,5", "", ".5"]) expect(DECIMAL_TEXT.test(bad)).toBe(false);
  });

  it("travelsExactly: đúng khi số JSON in lại đúng chữ số", () => {
    expect(travelsExactly("9007199254740991")).toBe(true);
    expect(travelsExactly("9007199254740993")).toBe(false);
    expect(travelsExactly("123456789012345.67")).toBe(true);
  });
});
