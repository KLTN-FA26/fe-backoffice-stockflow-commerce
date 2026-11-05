import { describe, expect, it } from "vitest";

import { fitScale } from "./use-element-size";

describe('mức "vừa khung" của bản đồ', () => {
  it("khung rộng mà thấp → khớp theo chiều dọc (cả bản đồ nằm trọn, không cuộn dọc)", () => {
    // Kho 60 × 40 m + lề 1 m mỗi phía = 62 × 42 m; khung 1240 × 420 px → giới hạn bởi chiều cao
    expect(fitScale({ width: 1240, height: 420 }, { width: 60, height: 40 }, 1)).toBe(10);
  });

  it("khung hẹp mà cao → khớp theo chiều ngang", () => {
    expect(fitScale({ width: 620, height: 2000 }, { width: 60, height: 40 }, 1)).toBe(10);
  });

  it("chưa đo được khung → 0 (chưa vẽ)", () => {
    expect(fitScale({ width: 0, height: 0 }, { width: 60, height: 40 }, 1)).toBe(0);
  });
});
