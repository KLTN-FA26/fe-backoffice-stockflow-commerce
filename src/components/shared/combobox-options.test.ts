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

describe("limitComboboxOptions — xếp hạng", () => {
  it("gõ đủ một mã → mã đó lên đầu dù mã dài hơn đứng trước trong danh sách (quét + Enter)", () => {
    const codes = ["A-01-10", "A-01-1", "A-01-11"];
    expect(limitComboboxOptions(codes, "A-01-1", (c) => c).visible).toEqual([
      "A-01-1",
      "A-01-10",
      "A-01-11",
    ]);
    // không phân biệt hoa thường
    expect(limitComboboxOptions(codes, "a-01-1", (c) => c).visible[0]).toBe("A-01-1");
  });

  it("thứ tự hạng: trùng hệt → bắt đầu bằng → chứa → chữ cái đầu → rải rác; cùng hạng giữ thứ tự gốc", () => {
    const items = ["xx-ab-yy", "ab-2", "ab", "ab-1", "a-x-b", "Á B"];
    expect(limitComboboxOptions(items, "ab", (c) => c).visible).toEqual([
      "ab",
      "ab-2",
      "ab-1",
      "xx-ab-yy",
      "Á B",
      "a-x-b",
    ]);
  });

  it("gõ tắt chữ cái đầu: 'hcm' ra 'Thành phố Hồ Chí Minh'", () => {
    const names = ["Thành phố Hà Nội", "Thành phố Hồ Chí Minh", "Tỉnh Bình Dương"];
    expect(limitComboboxOptions(names, "hcm", (n) => n).visible).toEqual(["Thành phố Hồ Chí Minh"]);
  });

  it("nhiều chuỗi cho một mục (tên + codename): lấy hạng tốt nhất", () => {
    const items = [{ name: "Thành phố Hồ Chí Minh", codename: "ho_chi_minh" }];
    expect(
      limitComboboxOptions(items, "ho_chi", (d) => [d.name, d.codename.replaceAll("_", " ")])
        .visible,
    ).toHaveLength(0);
    expect(
      limitComboboxOptions(items, "ho chi", (d) => [d.name, d.codename.replaceAll("_", " ")])
        .visible,
    ).toHaveLength(1);
  });

  it("hạng áp trước khi cắt 10 dòng: mã trùng hệt ở cuối danh sách vẫn nằm trong 10 dòng hiện", () => {
    const codes = [...Array.from({ length: 30 }, (_, i) => `B-${i}-X`), "B-1"];
    expect(limitComboboxOptions(codes, "B-1", (c) => c).visible[0]).toBe("B-1");
  });
});
