import { describe, expect, it } from "vitest";

import { formatFixed, formatNumber } from "./number";

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
