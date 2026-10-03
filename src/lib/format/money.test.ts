import { describe, expect, it } from "vitest";

import { currencyFractionDigits, fitsCurrencyScale, formatCompact, formatMoney } from "./money";

describe("formatMoney", () => {
  it("formats VND without decimals", () => {
    expect(formatMoney(1500000, "VND")).toMatch(/1\.500\.000\s?₫/);
  });

  it("keeps a non-VND currency instead of re-labelling it as VND", () => {
    const eur = formatMoney(750, "EUR");
    expect(eur).toContain("€");
    expect(eur).not.toContain("₫");
  });

  it("falls back to '<amount> <CODE>' for a code Intl does not accept", () => {
    expect(formatMoney(10, "ZZ")).toContain("ZZ");
  });

  it("compact form only abbreviates VND", () => {
    expect(formatCompact(2_500_000_000, "VND")).toContain("tỷ");
    expect(formatCompact(2_500, "USD")).toContain("$");
  });
});

describe("currencyFractionDigits / fitsCurrencyScale (khớp BE Money HALF_UP)", () => {
  it("VND 0 chữ số thập phân, USD/CNY/EUR 2", () => {
    expect(currencyFractionDigits("VND")).toBe(0);
    expect(currencyFractionDigits("USD")).toBe(2);
    expect(currencyFractionDigits("CNY")).toBe(2);
    expect(currencyFractionDigits("EUR")).toBe(2);
  });

  it("VND có phần lẻ → không hợp lệ (BE sẽ làm tròn)", () => {
    expect(fitsCurrencyScale(1000, "VND")).toBe(true);
    expect(fitsCurrencyScale(1000.5, "VND")).toBe(false);
  });

  it("USD tối đa 2 chữ số thập phân, chịu được sai số float", () => {
    expect(fitsCurrencyScale(0.1 + 0.2, "USD")).toBe(true);
    expect(fitsCurrencyScale(12.34, "USD")).toBe(true);
    expect(fitsCurrencyScale(12.345, "USD")).toBe(false);
  });
});

describe("formatMoney theo số chữ số thập phân ISO", () => {
  it("JPY không có phần lẻ (giống VND), EUR giữ 2 chữ số", () => {
    expect(formatMoney(1234.5, "JPY")).not.toMatch(/[.,]50?/);
    expect(formatMoney(12.5, "EUR")).toMatch(/12,50/);
  });
});
