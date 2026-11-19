import { describe, expect, it } from "vitest";

import {
  capacitySegments,
  capacityWarnings,
  countGroups,
  factorPercentText,
  filterBoards,
  findBoardByCode,
  freeTone,
  groupsOfTab,
  usageTone,
} from "../selectors";
import { fullBoard, roomyBoard } from "./fixtures";

describe("filterBoards / findBoardByCode", () => {
  it("lọc theo mã hoặc tên, không phân biệt hoa thường; rỗng giữ nguyên", () => {
    const boards = [roomyBoard, fullBoard];
    expect(filterBoards(boards, "  ").map((b) => b.warehouseCode)).toEqual(["HCM01", "HN01"]);
    expect(filterBoards(boards, "hn0").map((b) => b.warehouseCode)).toEqual(["HN01"]);
    expect(filterBoards(boards, "THỦ ĐỨC").map((b) => b.warehouseCode)).toEqual(["HCM01"]);
  });
  it("tìm kho theo prefix trên URL", () => {
    expect(findBoardByCode([roomyBoard, fullBoard], "HN01")?.warehouseId).toBe("wh-hn");
    expect(findBoardByCode(undefined, "HN01")).toBeUndefined();
  });
});

describe("groupsOfTab (docs 06 §4.6 bước 4)", () => {
  it("tab zone gồm zone và nhóm 'Không thuộc zone' — nhóm này luôn cuối", () => {
    expect(groupsOfTab(roomyBoard, "zones").map((g) => g.kind)).toEqual(["ZONE", "NO_ZONE"]);
  });
  it("kệ và khu tách riêng; đếm theo tab", () => {
    expect(groupsOfTab(roomyBoard, "shelves").map((g) => g.code)).toEqual(["A01"]);
    expect(groupsOfTab(roomyBoard, "areas").map((g) => g.code)).toEqual(["RCV01"]);
    expect(countGroups(roomyBoard)).toEqual({ zones: 2, shelves: 1, areas: 1 });
  });
  it("BR-19: khu vực không có sức chứa — chỉ có Đang chiếm", () => {
    const [area] = groupsOfTab(roomyBoard, "areas");
    expect(area?.capacityM3).toBeUndefined();
    expect(area?.occupiedPercent).toBeUndefined();
    expect(area?.occupiedM3).toBe(10);
  });
});

describe("usageTone / freeTone", () => {
  it("chưa có sức chứa → trung tính; dưới ngưỡng → info; từ 85% → warning; vượt 100% → danger", () => {
    expect(usageTone(undefined)).toBe("neutral");
    expect(usageTone(47.06)).toBe("info");
    expect(usageTone(85)).toBe("warning");
    expect(usageTone(100)).toBe("warning");
    expect(usageTone(100.01)).toBe("danger");
  });
  it("BR-21: còn trống âm → danger", () => {
    expect(freeTone(-0.001)).toBe("danger");
    expect(freeTone(0)).toBe("neutral");
    expect(freeTone(null)).toBe("neutral");
  });
});

describe("capacitySegments", () => {
  it("còn chỗ: thang = sức chứa, vạch sức chứa ở 100%, không vượt", () => {
    const { segments, capacityMark, overflowM3 } = capacitySegments(roomyBoard);
    expect(segments.map((s) => [s.key, Number(s.width.toFixed(2))])).toEqual([
      ["occupied", 47.06],
      ["incoming", 11.76],
      ["pending", 5.88],
    ]);
    expect(capacityMark).toBe(100);
    expect(overflowM3).toBe(0);
  });
  it("vượt sức chứa: thang giãn theo tổng nhu cầu, phần vượt = −còn trống nếu duyệt hết", () => {
    const { segments, capacityMark, overflowM3 } = capacitySegments(fullBoard);
    const total = segments.reduce((sum, s) => sum + s.width, 0);
    expect(Number(total.toFixed(6))).toBe(100);
    expect(Number(capacityMark.toFixed(2))).toBe(88.89);
    expect(overflowM3).toBe(25);
  });
});

describe("capacityWarnings (BR-21, C40)", () => {
  it("kho còn chỗ, đủ kích thước → không cảnh báo", () => {
    expect(capacityWarnings(roomyBoard)).toEqual([]);
  });
  it("còn trống dự kiến âm → danger kèm số m³ thiếu; thiếu kích thước → warning", () => {
    expect(capacityWarnings(fullBoard)).toEqual([
      { key: "negative", tone: "danger", value: 20 },
      { key: "binsWithoutVolume", tone: "warning", value: 3 },
      { key: "cartonsWithoutSize", tone: "warning", value: 4 },
      { key: "productionCartonsWithoutSize", tone: "warning", value: 6 },
    ]);
  });
  it("chỉ âm khi duyệt hết → warning riêng", () => {
    const board = { ...roomyBoard, freeIfAllApprovedM3: -5 };
    expect(capacityWarnings(board)).toEqual([
      { key: "negativeIfApproved", tone: "warning", value: 5 },
    ]);
  });
});

describe("factorPercentText", () => {
  it("hệ số (0, 1] → phần trăm, bỏ số 0 thừa", () => {
    expect(factorPercentText(0.85)).toBe("85");
    expect(factorPercentText(1)).toBe("100");
    expect(factorPercentText(0.8525)).toBe("85.25");
  });
});
