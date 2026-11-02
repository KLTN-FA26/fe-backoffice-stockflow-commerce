import { describe, expect, it } from "vitest";

import { WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { LAYOUT } from "./__fixtures__/layout";
import { draftFromLayout } from "./draft";
import { duplicatedGroup, keysInBox } from "./draft-group";
import { historyFromLayout, historyReducer } from "./draft-history";
import { boxOf } from "./selectors";

import type { DraftItem } from "./draft";
import type { HistoryAction } from "./draft-history";

const run = (...actions: HistoryAction[]) =>
  actions.reduce(historyReducer, historyFromLayout(LAYOUT));
const itemOf = (key: string): DraftItem => {
  const item = draftFromLayout(LAYOUT).items.find((candidate) => candidate.key === key);
  if (!item) throw new Error(`thiếu ${key}`);
  return item;
};
const yOf = (item: DraftItem) => (item.kind === "boundary" ? item.startY : item.footprint.y);

describe("chọn vùng — keysInBox", () => {
  it("chọn mọi hình chạm khung kéo, kể cả tường dẹt; không lấy hình ngoài khung", () => {
    const draft = draftFromLayout(LAYOUT);
    expect(keysInBox(draft, { x: 4, y: 4, w: 12, h: 3 })).toEqual(["shelf-a01"]);
    expect(keysInBox(draft, { x: 10, y: -1, w: 5, h: 2 })).toEqual(["wall-n"]);
    expect(keysInBox(draft, { x: 0, y: -1, w: 60, h: 12 })).toEqual([
      "area-rcv",
      "shelf-a01",
      "wall-n",
    ]);
    expect(keysInBox(draft, { x: 20, y: 20, w: 2, h: 2 })).toEqual([]);
  });
});

describe("sao chép / dán cả nhóm — duplicatedGroup", () => {
  it("bản sao nằm ngay dưới hộp bao của nhóm, giữ nguyên khoảng cách giữa các hình (BR-07)", () => {
    const draft = draftFromLayout(LAYOUT);
    const [shelf, area] = [itemOf("shelf-a01"), itemOf("area-rcv")];
    const copies = duplicatedGroup(draft, [shelf, area]);
    // Hộp bao nhóm: y 2 → 10 (cao 8) → dời xuống 8 + một bước lưới
    const dy = 8 + LIMITS.snapStep;
    expect(copies.map(yOf)).toEqual([yOf(shelf) + dy, yOf(area) + dy]);
    expect(copies.map((c) => (c.kind === "boundary" ? c.startX : boxOf(c.footprint).x))).toEqual([
      5, 40,
    ]);
    expect(copies.map((c) => [c.key, c.id])).toEqual([
      ["new-0", null],
      ["new-1", null],
    ]);
  });

  it("mã của các bản sao trong cùng một lần dán không trùng nhau (BR-13)", () => {
    const drawn = run({
      type: "draw",
      shape: { kind: "shelf", box: { x: 20, y: 20, w: 4, h: 1 } },
    }).present;
    const shelves = drawn.items.filter((item) => item.kind === "shelf");
    const codes = duplicatedGroup(drawn, shelves).map((c) => (c.kind === "shelf" ? c.code : ""));
    expect(new Set(codes).size).toBe(shelves.length);
    const taken = shelves.map((s) => (s.kind === "shelf" ? s.code : ""));
    for (const code of codes) expect(taken).not.toContain(code);
  });
});

describe("thao tác nhóm là MỘT bước hoàn tác", () => {
  it("xoá cả nhóm: hình đã lưu vào danh sách xoá (BR-04); Ctrl+Z trả lại tất cả", () => {
    const removed = run({ type: "removeMany", keys: ["shelf-a01", "wall-n"] });
    expect(removed.present.items.map((item) => item.key)).toEqual(["area-rcv"]);
    expect(removed.present.removed.map((item) => item.key)).toEqual(["shelf-a01", "wall-n"]);
    const undone = historyReducer(removed, { type: "undo" });
    expect(undone.present.items).toHaveLength(3);
    expect(undone.present.removed).toEqual([]);
  });

  it("dán cả nhóm thêm mọi bản sao trong một bước; Ctrl+Z bỏ hết", () => {
    const pasted = run({ type: "pasteMany", items: [itemOf("shelf-a01"), itemOf("wall-n")] });
    expect(pasted.present.items).toHaveLength(5);
    expect(historyReducer(pasted, { type: "undo" }).present.items).toHaveLength(3);
  });
});
