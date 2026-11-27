import { describe, expect, it } from "vitest";

import { beStandardPriceSchema } from "../schemas";
import { compareDecimalText, matchesStandardPriceColumns } from "../selectors";

/** Fixture đi qua đúng schema BE — không ép kiểu tay. */
const price = beStandardPriceSchema.parse({
  sku: "LY-GIAY-12OZ",
  productName: "Ly giấy 2 lớp",
  variantName: "12 oz",
  moq: 10,
  tiers: [{ minQuantity: 10, unitPrice: 1300 }],
  note: null,
  version: 0,
});

const NONE = { sku: "", product: "", variant: "", priceFrom: "", priceTo: "" };

describe("compareDecimalText", () => {
  it("so theo giá trị, không theo chữ: 1000 > 990, 1250.5 > 1250", () => {
    expect(compareDecimalText("1000", "990")).toBeGreaterThan(0);
    expect(compareDecimalText("1250.5", "1250")).toBeGreaterThan(0);
    expect(compareDecimalText("01300", "1300")).toBe(0);
  });
});

describe("matchesStandardPriceColumns", () => {
  it("quy cách gõ chữ; khoảng đơn giá khớp khi có ít nhất một bậc trong khoảng", () => {
    expect(matchesStandardPriceColumns(price, { ...NONE, variant: "12 OZ" })).toBe(true);
    expect(
      matchesStandardPriceColumns(price, { ...NONE, priceFrom: "1300", priceTo: "1300" }),
    ).toBe(true);
    expect(matchesStandardPriceColumns(price, { ...NONE, priceFrom: "1301" })).toBe(false);
  });
  it("ô rỗng không lọc", () => {
    expect(matchesStandardPriceColumns(price, { ...NONE, sku: "  " })).toBe(true);
  });
  it("bỏ dấu, không phân biệt hoa thường, mỗi cột lọc đúng trường của nó", () => {
    expect(matchesStandardPriceColumns(price, { ...NONE, sku: "12oz", product: "ly giay" })).toBe(
      true,
    );
    expect(matchesStandardPriceColumns(price, { ...NONE, sku: "ly giay" })).toBe(false);
  });
  it("sản phẩm chưa có tên chỉ khớp khi không lọc cột sản phẩm", () => {
    const unnamed = { ...price, productName: null };
    expect(matchesStandardPriceColumns(unnamed, { ...NONE, product: "ly" })).toBe(false);
    expect(matchesStandardPriceColumns(unnamed, { ...NONE, sku: "ly" })).toBe(true);
  });
});
