import { describe, expect, it } from "vitest";

import { WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { LAYOUT } from "./__fixtures__/layout";
import { changeCount } from "./draft";
import { historyFromLayout, historyReducer } from "./draft-history";

import type { HistoryAction } from "./draft-history";

const DRAW: HistoryAction = {
  type: "draw",
  shape: { kind: "shelf", box: { x: 20, y: 20, w: 4, h: 1 } },
};
const rename = (name: string, tag?: string): HistoryAction => ({
  type: "update",
  key: "shelf-a01",
  apply: (item) => (item.kind === "shelf" ? { ...item, name } : item),
  tag,
});
const run = (...actions: HistoryAction[]) =>
  actions.reduce(historyReducer, historyFromLayout(LAYOUT));
const nameOfA01 = (state: ReturnType<typeof run>) =>
  state.present.items.find((item) => item.key === "shelf-a01");

describe("hoàn tác / làm lại bản nháp (Ctrl+Z / Ctrl+Shift+Z)", () => {
  it("Ctrl+Z bỏ bước vừa làm, Ctrl+Shift+Z làm lại; thao tác mới xoá nhánh làm lại", () => {
    const drawn = run(DRAW);
    expect(changeCount(drawn.present)).toBe(1);
    const undone = historyReducer(drawn, { type: "undo" });
    expect(changeCount(undone.present)).toBe(0);
    const redone = historyReducer(undone, { type: "redo" });
    expect(changeCount(redone.present)).toBe(1);
    expect(historyReducer(undone, rename("Kệ khác")).future).toEqual([]);
  });

  it("gõ liên tục trong modal (cùng tag) chỉ tốn một bước hoàn tác", () => {
    const typed = run(
      rename("K", "inspect:a01"),
      rename("Ke", "inspect:a01"),
      rename("Kệ", "inspect:a01"),
    );
    expect(typed.past).toHaveLength(1);
    expect(nameOfA01(historyReducer(typed, { type: "undo" }))).toMatchObject({ name: "Kệ A01" });
  });

  it("lưu xong một phần (synced) xoá lịch sử — bước đã gửi BE không hoàn tác ở client", () => {
    const state = run(DRAW, { type: "synced", saved: [], removedKeys: [] });
    expect(state.past).toEqual([]);
    expect(historyReducer(state, { type: "undo" })).toBe(state);
  });

  it(`giữ tối đa ${LIMITS.historyLimit} bước`, () => {
    const many = Array.from({ length: LIMITS.historyLimit + 5 }, (_, i) => rename(`Kệ ${i}`));
    expect(run(...many).past).toHaveLength(LIMITS.historyLimit);
  });

  it("Ctrl+D nhân bản kệ: hình mới, mã kế tiếp, ngay dưới hình gốc (không chồng lấn), mang tầng / bin", () => {
    const state = run({ type: "duplicate", key: "shelf-a01" });
    const copy = state.present.items.at(-1);
    expect(copy).toMatchObject({ kind: "shelf", id: null, code: "K01" });
    if (copy?.kind !== "shelf") throw new Error("thiếu bản sao");
    // A01 ở (5, 5), dài 1,2 m → bản sao ở y = 5 + 1,2 + 0,5
    expect(copy.footprint).toMatchObject({ x: 5, y: 6.7 });
    expect(copy.build).not.toBeNull();
  });
});
