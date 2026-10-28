import { describe, expect, it } from "vitest";

import {
  ancestorPathsOf,
  compareCategoryPath,
  expandablePaths,
  inTreeOrder,
  toClientPage,
  visibleTreeRows,
} from "./category-tree";

const rows = (...paths: string[]) => paths.map((path) => ({ path }));
const paths = (list: { path: string }[]) => list.map((r) => r.path);

describe("inTreeOrder — cha luôn ngay trước con", () => {
  it("mã có '-' trùng tiền tố không chen giữa cha và con", () => {
    // Sắp cả chuỗi (code point): /AO, /AO-KHOAC, /AO/THUN — THUN thành con của AO-KHOAC
    expect(paths(inTreeOrder(rows("/AO", "/AO-KHOAC", "/AO/THUN")))).toEqual([
      "/AO",
      "/AO/THUN",
      "/AO-KHOAC",
    ]);
  });

  it("collation bỏ dấu cũng không làm vỡ cây (AB không chen giữa A và A/Z)", () => {
    expect(paths(inTreeOrder(rows("/AB", "/A/Z", "/A")))).toEqual(["/A", "/A/Z", "/AB"]);
  });

  it("nhiều cấp, không đổi mảng gốc", () => {
    const input = rows("/B", "/A/X/1", "/A", "/A/X", "/A/W");
    expect(paths(inTreeOrder(input))).toEqual(["/A", "/A/W", "/A/X", "/A/X/1", "/B"]);
    expect(input[0]?.path).toBe("/B");
  });

  it("anh em cùng cấp theo sortOrder trước, rồi mới tới mã — con đi theo cha", () => {
    const input = [
      { path: "/AO", sortOrder: 5 },
      { path: "/AO/THUN", sortOrder: 0 },
      { path: "/PHU-KIEN", sortOrder: 0 },
      { path: "/PHU-KIEN/LY", sortOrder: 2 },
      { path: "/PHU-KIEN/BINH", sortOrder: 1 },
    ];
    expect(paths(inTreeOrder(input))).toEqual([
      "/PHU-KIEN",
      "/PHU-KIEN/BINH",
      "/PHU-KIEN/LY",
      "/AO",
      "/AO/THUN",
    ]);
  });

  it("thiếu tổ tiên trong danh sách (đang lọc) thì so theo mã", () => {
    const input = [
      { path: "/B/Y", sortOrder: 0 },
      { path: "/A/X", sortOrder: 9 },
    ];
    expect(paths(inTreeOrder(input))).toEqual(["/A/X", "/B/Y"]);
  });

  it("compareCategoryPath: cùng path = 0, cha < con", () => {
    expect(compareCategoryPath("/A", "/A")).toBe(0);
    expect(compareCategoryPath("/A", "/A/B")).toBeLessThan(0);
    expect(compareCategoryPath("/A_B", "/A/B")).toBeGreaterThan(0);
  });
});

describe("toClientPage — phân trang phía FE theo hình PageResponse", () => {
  const list = Array.from({ length: 23 }, (_, i) => i);

  it("cắt đúng trang, đủ cờ hasNext / hasPrevious", () => {
    expect(toClientPage(list, 1, 10)).toMatchObject({
      items: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
      page: 1,
      totalElements: 23,
      totalPages: 3,
      hasNext: true,
      hasPrevious: true,
    });
  });

  it("trang vượt cuối → về trang cuối; danh sách rỗng → trang 0", () => {
    expect(toClientPage(list, 9, 10)).toMatchObject({ page: 2, items: [20, 21, 22] });
    expect(toClientPage([], 3, 10)).toMatchObject({ page: 0, items: [], totalPages: 0 });
  });
});

describe("visibleTreeRows — cây thư mục kiểu Drive", () => {
  const tree = rows("/A", "/A/X", "/A/X/1", "/B");

  it("chỉ hiện dòng có mọi tổ tiên đang mở, kèm số con trực tiếp", () => {
    expect(visibleTreeRows(tree, new Set()).map((r) => [r.path, r.childCount])).toEqual([
      ["/A", 1],
      ["/B", 0],
    ]);
    expect(paths(visibleTreeRows(tree, new Set(["/A"])))).toEqual(["/A", "/A/X", "/B"]);
    // Mở cháu mà cha đóng → cháu vẫn ẩn
    expect(paths(visibleTreeRows(tree, new Set(["/A/X"])))).toEqual(["/A", "/B"]);
    expect(paths(visibleTreeRows(tree, new Set(["/A", "/A/X"])))).toEqual(paths(tree));
  });

  it("null = hiện phẳng; tổ tiên không có trong danh sách thì không ẩn dòng", () => {
    expect(paths(visibleTreeRows(tree, null))).toEqual(paths(tree));
    expect(paths(visibleTreeRows(rows("/Z/ORPHAN"), new Set()))).toEqual(["/Z/ORPHAN"]);
  });

  it("expandablePaths / ancestorPathsOf", () => {
    expect(expandablePaths(tree).sort()).toEqual(["/A", "/A/X"]);
    expect(ancestorPathsOf("/A/X/1")).toEqual(["/A", "/A/X"]);
    expect(ancestorPathsOf("/A")).toEqual([]);
  });
});
