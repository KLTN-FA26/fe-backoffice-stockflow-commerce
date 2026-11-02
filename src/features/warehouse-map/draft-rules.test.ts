import { describe, expect, it } from "vitest";

import { LAYOUT } from "./__fixtures__/layout";
import { draftFromLayout } from "./draft";
import { draftReducer, newKeyOf } from "./draft-edit";
import { validateDraft } from "./draft-rules";

import type { DraftItem, MapDraft } from "./draft";
import type { DrawnShape } from "./draft-edit";

const FRAME = LAYOUT.warehouse;

/** Vẽ một hình rồi trả về bản nháp + khoá của hình đó. */
function draw(draft: MapDraft, shape: DrawnShape): [MapDraft, string] {
  return [draftReducer(draft, { type: "draw", shape }), newKeyOf(draft)];
}

const update = (draft: MapDraft, key: string, apply: (item: DraftItem) => DraftItem) =>
  draftReducer(draft, { type: "update", key, apply });

const issuesOf = (draft: MapDraft, key: string) => validateDraft(draft, FRAME).get(key) ?? {};

const shelfAt = (x: number, y: number, w = 4, h = 1): DrawnShape => ({
  kind: "shelf",
  box: { x, y, w, h },
});

describe("luật bản nháp bản đồ (docs 06 §6)", () => {
  it("bố cục demo hợp lệ ngay khi vào chế độ sửa", () => {
    expect(validateDraft(draftFromLayout(LAYOUT), FRAME).size).toBe(0);
  });

  it("BR-06: kệ ra ngoài khung bản đồ bị báo ở vị trí", () => {
    const [draft, key] = draw(draftFromLayout(LAYOUT), shelfAt(58, 20, 4, 1));
    expect(issuesOf(draft, key).placement).toMatch(/BR-06/);
  });

  it("BR-07: chồng lấn kệ khác trong bản nháp bị báo; chạm cạnh thì không", () => {
    const [overlap, a] = draw(draftFromLayout(LAYOUT), shelfAt(6, 5));
    expect(issuesOf(overlap, a).placement).toMatch(/A01/);
    const [touching, b] = draw(draftFromLayout(LAYOUT), shelfAt(15, 5));
    expect(issuesOf(touching, b).placement).toBeUndefined();
  });

  it("BR-07: kệ đã lưu bị xoá (sẽ Inactive) và kệ INACTIVE không chặn chỗ", () => {
    const removed = draftReducer(draftFromLayout(LAYOUT), { type: "remove", key: "shelf-a01" });
    const [onA01, a] = draw(removed, shelfAt(6, 5));
    expect(issuesOf(onA01, a).placement).toBeUndefined();
    const [onZ99, z] = draw(draftFromLayout(LAYOUT), shelfAt(30, 30, 1, 1));
    expect(issuesOf(onZ99, z).placement).toBeUndefined();
  });

  it("BR-07: kệ đã có bin không thu nhỏ quá phạm vi bin", () => {
    const draft = update(draftFromLayout(LAYOUT), "shelf-a01", (item) =>
      item.kind === "shelf" ? { ...item, footprint: { ...item.footprint, width: 8 } } : item,
    );
    expect(issuesOf(draft, "shelf-a01").placement).toMatch(/BR-07/);
  });

  it("BR-10 / BR-13: mã sai định dạng, trùng kệ khác, hoặc trùng mã INACTIVE đều bị chặn", () => {
    const [draft, key] = draw(draftFromLayout(LAYOUT), shelfAt(20, 20));
    const withCode = (code: string) =>
      update(draft, key, (item) => (item.kind === "shelf" ? { ...item, code } : item));
    expect(issuesOf(withCode("K-1"), key).code).toMatch(/BR-10/);
    expect(issuesOf(withCode("a01"), key).code).toBeDefined();
    expect(issuesOf(withCode("Z99"), key).code).toBeDefined();
    expect(issuesOf(withCode("K02"), key).code).toBeUndefined();
  });

  it("BR-08: kệ có bin cho lấy hàng mà không có mặt lấy hàng bị chặn", () => {
    const [draft, key] = draw(draftFromLayout(LAYOUT), shelfAt(20, 20));
    const noFace = update(draft, key, (item) =>
      item.kind === "shelf"
        ? { ...item, pickFaces: { north: false, east: false, south: false, west: false } }
        : item,
    );
    expect(issuesOf(noFace, key).pickFaces).toMatch(/BR-08/);
  });

  it("BR-14 / BR-15: hàng × cột ≤ 200, ≤ 20 tầng, kiểu chữ hàng ≤ 26 hàng", () => {
    const [draft, key] = draw(draftFromLayout(LAYOUT), shelfAt(20, 20));
    const withBuild = (patch: object) =>
      update(draft, key, (item) =>
        item.kind === "shelf" && item.build
          ? { ...item, build: { ...item.build, ...patch } }
          : item,
      );
    expect(issuesOf(withBuild({ rowCount: 15, columnCount: 14 }), key).build).toMatch(/BR-14/);
    expect(issuesOf(withBuild({ levelCount: 21 }), key).build).toMatch(/BR-15/);
    expect(
      issuesOf(withBuild({ namingScheme: "ROW_LETTER_COLUMN", rowCount: 27, columnCount: 1 }), key)
        .build,
    ).toBeDefined();
  });

  it("BR-11: khu chứa hàng đã lưu không đổi thành NON_STORAGE", () => {
    const draft = update(draftFromLayout(LAYOUT), "area-rcv", (item) =>
      item.kind === "area" ? { ...item, type: "NON_STORAGE" } : item,
    );
    expect(issuesOf(draft, "area-rcv").type).toMatch(/BR-11/);
  });

  it("BR-06: tường có đầu mút ngoài khung, hoặc hai đầu trùng nhau, bị chặn", () => {
    const [outside, a] = draw(draftFromLayout(LAYOUT), {
      kind: "wall",
      line: { startX: 0, startY: 10, endX: 70, endY: 10 },
    });
    expect(issuesOf(outside, a).line).toMatch(/BR-06/);
    const zero = update(outside, a, (item) =>
      item.kind === "boundary" ? { ...item, endX: 0, endY: 10 } : item,
    );
    expect(issuesOf(zero, a).line).toBeDefined();
  });
});
