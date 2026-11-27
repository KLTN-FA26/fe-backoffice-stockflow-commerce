import { describe, expect, it } from "vitest";

import { beCustomerPriceSchema } from "../schemas";
import { matchesPriceColumns } from "../selectors";

import type { PriceColumnFilters } from "../selectors";

/** Fixture đi qua đúng schema BE (đơn giá số nguyên → chuỗi chữ số, `unitPriceExact`). */
const price = (sku: string, moq: number, prices: number[]) =>
  beCustomerPriceSchema.parse({
    customerId: "c-1",
    sku,
    measure: "CARTON",
    moq,
    tiers: prices.map((unitPrice, i) => ({ minQuantity: moq * (i + 1), unitPrice })),
    note: null,
    version: 0,
  });

const NONE: PriceColumnFilters = {
  sku: "",
  moqFrom: "",
  moqTo: "",
  tiersFrom: "",
  tiersTo: "",
  lowestFrom: "",
  lowestTo: "",
  highestFrom: "",
  highestTo: "",
};
const LY = price("LYP16-HNC", 10, [990, 890, 790]);
const TO = price("TO750-HNC", 20, [2130, 1930]);

describe("matchesPriceColumns — lọc trên header bảng giá khách", () => {
  it("không lọc gì → mọi dòng khớp", () => {
    expect(matchesPriceColumns(LY, NONE)).toBe(true);
  });

  it("SKU chứa chữ, chuẩn hoá in hoa như BE", () => {
    expect(matchesPriceColumns(LY, { ...NONE, sku: " lyp " })).toBe(true);
    expect(matchesPriceColumns(TO, { ...NONE, sku: "lyp" })).toBe(false);
  });

  it("MOQ và số bậc theo khoảng, hai đầu tính cả biên, đầu rỗng = không chặn", () => {
    expect(matchesPriceColumns(LY, { ...NONE, moqFrom: "10", moqTo: "10" })).toBe(true);
    expect(matchesPriceColumns(TO, { ...NONE, moqTo: "15" })).toBe(false);
    expect(matchesPriceColumns(LY, { ...NONE, tiersFrom: "3" })).toBe(true);
    expect(matchesPriceColumns(TO, { ...NONE, tiersFrom: "3" })).toBe(false);
  });

  it("giá thấp nhất / cao nhất so theo chuỗi chữ số qua mọi bậc (không lấy bậc đầu)", () => {
    expect(matchesPriceColumns(LY, { ...NONE, lowestFrom: "790", lowestTo: "790" })).toBe(true);
    expect(matchesPriceColumns(LY, { ...NONE, highestTo: "989" })).toBe(false);
    // "1000" > "990" dù so chữ "1" < "9" — độ dài quyết định trước
    expect(matchesPriceColumns(TO, { ...NONE, lowestFrom: "1000" })).toBe(true);
    expect(matchesPriceColumns(LY, { ...NONE, lowestFrom: "01000" })).toBe(false);
  });
});
