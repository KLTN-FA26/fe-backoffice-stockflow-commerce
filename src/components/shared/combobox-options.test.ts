import { describe, expect, it } from "vitest";

import { limitComboboxOptions } from "./combobox-options";

const NAMES = Array.from({ length: 25 }, (_, i) => `Phường ${i + 1}`).concat("Thủ Dầu Một");

describe("limitComboboxOptions", () => {
  it("ô tìm trống → 10 mục đầu, báo số mục còn lại", () => {
    const { visible, hidden } = limitComboboxOptions(NAMES, "", (n) => n);
    expect(visible).toHaveLength(10);
    expect(hidden).toBe(16);
  });

  it("lọc không phân biệt hoa thường / dấu, kể cả đ", () => {
    expect(limitComboboxOptions(NAMES, "thu dau mot", (n) => n).visible).toEqual(["Thủ Dầu Một"]);
    expect(limitComboboxOptions(["Đà Nẵng"], "da nang", (n) => n).visible).toEqual(["Đà Nẵng"]);
  });

  it("ít hơn giới hạn → không có mục ẩn", () => {
    const { visible, hidden } = limitComboboxOptions(NAMES, "Phường 2", (n) => n);
    expect(visible.length).toBeLessThanOrEqual(10);
    expect(hidden).toBe(0);
  });
});
