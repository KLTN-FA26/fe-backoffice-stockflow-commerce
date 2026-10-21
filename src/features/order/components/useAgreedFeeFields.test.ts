import { describe, expect, it } from "vitest";

import { parseFeeAmount } from "./useAgreedFeeFields";

describe("parseFeeAmount — số tiền phí gõ tay → số nguyên VND, không đọc sai lặng lẽ", () => {
  it.each([
    ["4000000", 4_000_000],
    ["  4000000  ", 4_000_000],
    ["4.000.000", 4_000_000],
    ["4,000,000", 4_000_000],
    ["4 000 000", 4_000_000],
    ["1.500", 1500],
    ["0", 0],
    ["12", 12],
  ])("%s → %d", (text, expected) => {
    expect(parseFeeAmount(text)).toBe(expected);
  });

  it.each([
    "150000.50", // dấu thập phân kiểu Anh — không được đọc thành 15.000.050
    "150.000,5", // dấu thập phân kiểu vi-VN
    "1,5",
    "1.5.0",
    "4.000,000", // trộn hai loại dấu nghìn
    "4..000",
    "1234.567", // nhóm đầu quá 3 chữ số
    "12abc",
    "-5",
    "",
    "   ",
  ])("%j → NaN (schema báo 'Nhập số tiền nguyên lớn hơn 0')", (text) => {
    expect(parseFeeAmount(text)).toBeNaN();
  });
});
