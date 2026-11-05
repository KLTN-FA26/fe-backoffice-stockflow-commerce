import { describe, expect, it } from "vitest";

import { LAYOUT } from "./__fixtures__/layout";
import { changeCount, draftFromLayout } from "./draft";
import { draftReducer, newKeyOf } from "./draft-edit";
import { planDraftSave, saveOpLabel } from "./draft-plan";

import type { DraftAction } from "./draft-edit";

const apply = (...actions: DraftAction[]) => actions.reduce(draftReducer, draftFromLayout(LAYOUT));

describe("bản nháp → danh sách request", () => {
  it("vào chế độ sửa chưa đổi gì → không có request nào", () => {
    const draft = draftFromLayout(LAYOUT);
    expect(changeCount(draft)).toBe(0);
    expect(planDraftSave(draft)).toEqual([]);
  });

  it("bản nháp không chứa kệ INACTIVE; mã gợi ý bỏ qua mã đã dùng", () => {
    const draft = draftFromLayout(LAYOUT);
    expect(draft.items.map((item) => item.key)).not.toContain("shelf-z99");
    const drawn = draftReducer(draft, {
      type: "draw",
      shape: { kind: "shelf", box: { x: 20, y: 20, w: 4, h: 1 } },
    });
    expect(drawn.items.at(-1)).toMatchObject({ kind: "shelf", code: "K01", id: null });
  });

  it("thứ tự an toàn: zone → gỡ hình → sửa hình cũ → tạo hình mới → tường / cửa", () => {
    const draft = apply(
      { type: "draw", shape: { kind: "wall", line: { startX: 0, startY: 5, endX: 0, endY: 9 } } },
      { type: "draw", shape: { kind: "shelf", box: { x: 20, y: 20, w: 4, h: 1 } } },
      {
        type: "update",
        key: "area-rcv",
        apply: (item) => (item.kind === "area" ? { ...item, name: "Khu nhận mới" } : item),
      },
      { type: "remove", key: "shelf-a01" },
      { type: "addZone", name: "Khu C", color: null },
    );
    expect(planDraftSave(draft).map(saveOpLabel)).toEqual([
      "Tạo zone Khu C",
      "Ngừng dùng A01",
      "Sửa khu vực RCV01",
      "Tạo kệ K01",
      "Tạo tường / cửa",
    ]);
    expect(changeCount(draft)).toBe(5);
  });

  it("xoá hình chưa lưu thì biến mất, không sinh request; sửa rồi trả lại như cũ thì hết thay đổi", () => {
    const first = draftFromLayout(LAYOUT);
    const key = newKeyOf(first);
    const draft = [
      { type: "draw", shape: { kind: "area", box: { x: 20, y: 20, w: 4, h: 4 } } },
      { type: "remove", key },
    ].reduce((d, a) => draftReducer(d, a as DraftAction), first);
    expect(planDraftSave(draft)).toEqual([]);
    const rename = (name: string): DraftAction => ({
      type: "update",
      key: "shelf-a01",
      apply: (item) => (item.kind === "shelf" ? { ...item, name } : item),
    });
    expect(changeCount(apply(rename("Kệ khác"), rename("Kệ A01")))).toBe(0);
  });

  it("lưu xong một phần: hình đã lưu có id + version, không còn là thay đổi", () => {
    const draft = apply({
      type: "draw",
      shape: { kind: "shelf", box: { x: 20, y: 20, w: 4, h: 1 } },
    });
    const key = draft.items.at(-1)?.key ?? "";
    const synced = draftReducer(draft, {
      type: "synced",
      saved: [{ key, id: "shelf-new", version: 2 }],
      removedKeys: [],
    });
    expect(synced.items.at(-1)).toMatchObject({ id: "shelf-new", version: 2, build: null });
    expect(changeCount(synced)).toBe(0);
  });
});
