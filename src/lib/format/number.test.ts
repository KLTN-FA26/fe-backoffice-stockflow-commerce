import { describe, expect, it } from "vitest";

import { formatDecimal, formatFixed, formatNumber, formatRatePercent } from "./number";

describe("formatFixed", () => {
  it("giữ đúng số chữ số thập phân, dấu phẩy thập phân vi-VN", () => {
    expect(formatFixed(5.898, 3)).toBe("5,898");
    expect(formatFixed(12, 3)).toBe("12,000");
    expect(formatFixed(33.1966, 2)).toBe("33,20");
  });
  it("nhóm hàng nghìn bằng dấu chấm", () => {
    expect(formatFixed(12032, 0)).toBe("12.032");
    expect(formatNumber(28200)).toBe("28.200");
  });
});

describe("formatDecimal", () => {
  it("bỏ số 0 thừa, làm tròn tới số chữ số tối đa", () => {
    expect(formatDecimal(12.5, 3)).toBe("12,5");
    expect(formatDecimal(1234.5678, 2)).toBe("1.234,57");
    expect(formatDecimal(-3, 3)).toBe("-3");
  });
});

describe("formatRatePercent", () => {
  it("BE gửi thuế suất dạng phần trăm: 8 → 8%, không phải 800%", () => {
    expect(formatRatePercent(8)).toBe("8%");
    expect(formatRatePercent(10)).toBe("10%");
    expect(formatRatePercent(5.25)).toBe("5,25%");
    expect(formatRatePercent(0)).toBe("0%");
  });
});
