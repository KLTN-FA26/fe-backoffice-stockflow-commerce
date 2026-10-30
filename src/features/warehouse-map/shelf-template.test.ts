import { describe, expect, it } from "vitest";

import { LAYOUT } from "./__fixtures__/layout";
import { DEFAULT_SHELF_BUILD, draftFromLayout, isChanged } from "./draft";
import { duplicatedItem } from "./draft-duplicate";
import { shelfTemplate } from "./shelf-template";

const [A01] = LAYOUT.shelves;
if (!A01) throw new Error("fixture thiếu kệ A01");

describe("shelfTemplate — thông số dựng lại kệ đã lưu", () => {
  it("lấy số tầng, cao tầng, lưới bin và loại bin từ tầng / bin thật", () => {
    expect(shelfTemplate(A01, DEFAULT_SHELF_BUILD)).toEqual({
      levelCount: 2,
      levelHeight: 1.4,
      generateBins: true,
      rowCount: 1,
      columnCount: 2,
      namingScheme: "SEQUENTIAL",
      binType: "PALLET",
      capacityUnits: null,
      maxWeight: null,
      pickable: true,
      putawayTarget: true,
    });
  });

  it("mã bin chữ hàng + số cột → kiểu ROW_LETTER_COLUMN", () => {
    const lettered = {
      ...A01,
      levels: A01.levels.map((level) => ({
        ...level,
        bins: level.bins.map((bin, i) => ({ ...bin, code: `A0${i + 1}` })),
      })),
    };
    expect(shelfTemplate(lettered, DEFAULT_SHELF_BUILD).namingScheme).toBe("ROW_LETTER_COLUMN");
  });

  it("kệ chưa có tầng / bin → giữ thông số gợi ý, không sinh bin", () => {
    const empty = shelfTemplate({ ...A01, levels: [] }, DEFAULT_SHELF_BUILD);
    expect(empty.levelCount).toBe(DEFAULT_SHELF_BUILD.levelCount);
    expect(empty.generateBins).toBe(false);
  });
});

describe("sao chép kệ đã lưu (Ctrl+D / Ctrl+C → Ctrl+V)", () => {
  it("bản sao dựng tầng / bin giống kệ gốc, không phải thông số mặc định", () => {
    const draft = draftFromLayout(LAYOUT);
    const source = draft.items.find((item) => item.kind === "shelf" && item.id === A01.id);
    if (!source || source.kind !== "shelf") throw new Error("thiếu kệ A01 trong bản nháp");
    const copy = duplicatedItem(draft, source, "copy-1");
    if (copy.kind !== "shelf") throw new Error("bản sao phải là kệ");
    expect(copy.build).toEqual(shelfTemplate(A01, DEFAULT_SHELF_BUILD));
    expect(copy.build?.binType).toBe("PALLET");
    // Giữ nguyên các thông số khác của kệ gốc
    expect(copy.pickFaces).toEqual(A01.pickFaces);
    expect(copy.zoneKey).toBe(A01.zoneId);
    expect(copy.defaultStorageClass).toBe(A01.defaultStorageClass);
    expect(copy.id).toBeNull();
  });

  it("thông số dựng lại không tính là thay đổi của kệ đã lưu", () => {
    const draft = draftFromLayout(LAYOUT);
    expect(draft.items.some((item) => isChanged(draft, item))).toBe(false);
  });
});
