import { describe, expect, it } from "vitest";

import { LAYOUT } from "./__fixtures__/layout";
import { DEFAULT_SHELF_BUILD, draftFromLayout } from "./draft";
import { draftReducer } from "./draft-edit";
import { draftLevels, layoutFromDraft } from "./draft-layout";

import type { DraftAction } from "./draft-edit";

const run = (...actions: DraftAction[]) => actions.reduce(draftReducer, draftFromLayout(LAYOUT));
const move = (key: string, x: number, y: number): DraftAction => ({
  type: "update",
  key,
  apply: (item) =>
    item.kind === "boundary" ? item : { ...item, footprint: { ...item.footprint, x, y } },
});

describe("layoutFromDraft — xem 3D bản nháp chưa lưu (docs 06 §4.1)", () => {
  it("bản nháp chưa sửa → giữ nguyên kệ, tầng, bin, khu vực, tường của bản đã lưu (bỏ vị trí INACTIVE)", () => {
    const live = LAYOUT.shelves.filter((s) => s.status !== "INACTIVE");
    const result = layoutFromDraft(LAYOUT, run());
    // `description` vắng ở bản đọc thì bản nháp ghi `null` — còn lại y hệt
    expect(result.shelves).toMatchObject(live);
    expect(result.areas.map((a) => a.id)).toEqual(LAYOUT.areas.map((a) => a.id));
    expect(result.boundaries.map((b) => b.id)).toEqual(LAYOUT.boundaries.map((b) => b.id));
    expect(result.zones.map((z) => z.id)).toEqual(LAYOUT.zones.map((z) => z.id));
  });

  it("dời kệ đã lưu → vị trí mới, tầng / bin / mã vị trí đi theo (bin tương đối trong kệ)", () => {
    const result = layoutFromDraft(LAYOUT, run(move("shelf-a01", 30, 20)));
    const shelf = result.shelves.find((s) => s.id === "shelf-a01");
    const before = LAYOUT.shelves.find((s) => s.id === "shelf-a01");
    expect(shelf?.footprint).toMatchObject({ x: 30, y: 20 });
    expect(shelf?.levels).toEqual(before?.levels);
  });

  it("kệ vừa vẽ → tầng + lưới bin theo thông số dựng, mã vị trí tạm không trùng tồn thật", () => {
    const drawn = run({
      type: "draw",
      shape: { kind: "shelf", box: { x: 20, y: 20, w: 4, h: 1 } },
    });
    const shelf = layoutFromDraft(LAYOUT, drawn).shelves.at(-1);
    const build = DEFAULT_SHELF_BUILD;
    expect(shelf?.levels).toHaveLength(build.levelCount);
    expect(shelf?.levels[1]?.elevation).toBe(build.levelHeight);
    expect(shelf?.levels[0]?.bins).toHaveLength(build.rowCount * build.columnCount);
    for (const bin of shelf?.levels.flatMap((l) => l.bins) ?? [])
      expect(bin.locationCode.startsWith("draft:")).toBe(true);
  });

  it("lưới bin chia đều bề rộng (cột) × chiều sâu (hàng), không tạo bin khi tắt sinh bin", () => {
    const build = { ...DEFAULT_SHELF_BUILD, levelCount: 1, rowCount: 2, columnCount: 3 };
    const [level] = draftLevels("k", 6, 1.2, build);
    expect(level?.bins.map((b) => [b.footprint.x, b.footprint.y, b.footprint.width])).toEqual([
      [0, 0, 2],
      [2, 0, 2],
      [4, 0, 2],
      [0, 0.6, 2],
      [2, 0.6, 2],
      [4, 0.6, 2],
    ]);
    expect(draftLevels("k", 6, 1.2, { ...build, generateBins: false })[0]?.bins).toEqual([]);
  });

  it("xoá hình đã lưu trong bản nháp → không vẽ; khu vực vừa vẽ không có mã vị trí", () => {
    const draft = run(
      { type: "remove", key: "area-rcv" },
      { type: "draw", shape: { kind: "area", box: { x: 2, y: 2, w: 3, h: 3 } } },
    );
    const result = layoutFromDraft(LAYOUT, draft);
    expect(result.areas.map((a) => a.id)).not.toContain("area-rcv");
    expect(result.areas.at(-1)?.locationCode).toBeNull();
  });

  it("zone mới trong bản nháp → kệ gán zone đó lấy đúng màu zone", () => {
    const draft = run({ type: "addZone", name: "Khu C", color: "#00AA88" });
    const zoneKey = draft.zones.at(-1)?.key ?? "";
    const assigned = draftReducer(draft, {
      type: "update",
      key: "shelf-a01",
      apply: (item) => (item.kind === "shelf" ? { ...item, zoneKey } : item),
    });
    const result = layoutFromDraft(LAYOUT, assigned);
    expect(result.zones.find((z) => z.id === zoneKey)?.color).toBe("#00AA88");
    expect(result.shelves.find((s) => s.id === "shelf-a01")?.zoneId).toBe(zoneKey);
  });
});
