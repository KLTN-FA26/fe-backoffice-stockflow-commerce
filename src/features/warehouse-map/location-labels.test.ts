import { describe, expect, it } from "vitest";

import { LAYOUT } from "./__fixtures__/layout";
import { checkNamedCodes, parseLocationCodes, printableLabelCodes } from "./location-labels";

import type { WarehouseLayout } from "./types";

/**
 * Bố cục có đủ loại vị trí bị bỏ qua khi in (BR-17): bin INACTIVE, bin của kệ INACTIVE, khu INACTIVE và khu NON_STORAGE
 * (không có mã vị trí). Bin BLOCKED của fixture vẫn in (docs 06 §4.3 bước 3).
 */
const [a01, z99] = LAYOUT.shelves;
const [level1, level2] = a01?.levels ?? [];
const rcv = LAYOUT.areas[0];
if (!a01 || !z99 || !level1 || !level2 || !rcv) throw new Error("fixture thiếu kệ / khu");
const bin = level2.bins[0];
if (!bin) throw new Error("fixture thiếu bin");

const MIXED: WarehouseLayout = {
  ...LAYOUT,
  shelves: [
    {
      ...a01,
      levels: [
        level1,
        {
          ...level2,
          bins: [
            ...level2.bins,
            { ...bin, id: "b-off", locationCode: "HCM-A01-2-C", status: "INACTIVE" },
          ],
        },
      ],
    },
    {
      ...z99,
      zoneId: "zone-a",
      levels: [
        { ...level1, id: "z99-1", bins: [{ ...bin, id: "b-z99", locationCode: "HCM-Z99-1-A" }] },
      ],
    },
  ],
  areas: [
    rcv,
    { ...rcv, id: "a-qc", code: "QC01", locationCode: "HCM-QC01", status: "INACTIVE" },
    { ...rcv, id: "a-office", code: "OFFICE", type: "NON_STORAGE", locationCode: null },
  ],
};

describe("parseLocationCodes — ô danh sách mã", () => {
  it("tách theo xuống dòng / dấu phẩy / khoảng trắng, viết hoa như máy quét, bỏ trùng giữ thứ tự", () => {
    expect(parseLocationCodes(" hcm-a01-1-a,HCM-RCV01\n\nHCM-A01-1-A ;  hcm-a01-2-a ")).toEqual([
      "HCM-A01-1-A",
      "HCM-RCV01",
      "HCM-A01-2-A",
    ]);
  });

  it("chỉ có dấu phân cách → rỗng", () => {
    expect(parseLocationCodes(" ,\n; ")).toEqual([]);
  });
});

describe("printableLabelCodes — BR-17: bỏ qua vị trí ngừng dùng", () => {
  it("cả kho: bin đang dùng (kể cả BLOCKED) rồi khu chứa hàng; bỏ bin / kệ / khu INACTIVE và khu NON_STORAGE", () => {
    expect(printableLabelCodes(MIXED, { scope: "WAREHOUSE" })).toEqual([
      "HCM-A01-1-A",
      "HCM-A01-1-B",
      "HCM-A01-2-A",
      "HCM-RCV01",
    ]);
  });

  it("một kệ, chọn tầng 2 → chỉ bin tầng 2; không chọn tầng → mọi tầng", () => {
    expect(
      printableLabelCodes(MIXED, { scope: "SHELF", shelfId: "shelf-a01", levelIndexes: [2] }),
    ).toEqual(["HCM-A01-2-A"]);
    expect(
      printableLabelCodes(MIXED, { scope: "SHELF", shelfId: "shelf-a01", levelIndexes: [] }),
    ).toHaveLength(3);
  });

  it("kệ INACTIVE → không nhãn nào (BE 422 LOCATION_LABELS_EMPTY)", () => {
    expect(
      printableLabelCodes(MIXED, { scope: "SHELF", shelfId: "shelf-z99", levelIndexes: [] }),
    ).toEqual([]);
  });

  it("một zone: chỉ bin của kệ trong zone, không gồm khu vực", () => {
    expect(printableLabelCodes(MIXED, { scope: "ZONE", zoneId: "zone-a" })).toEqual([
      "HCM-A01-1-A",
      "HCM-A01-1-B",
      "HCM-A01-2-A",
    ]);
  });
});

describe("checkNamedCodes — docs 06 §4.3 bước 3: nêu đích danh mã không in được thì báo lỗi", () => {
  it("phân biệt mã kho không có (gồm khu NON_STORAGE) với mã đã ngừng dùng", () => {
    expect(
      checkNamedCodes(MIXED, [
        "HCM-A01-1-A",
        "HCM-NOPE",
        "HCM-A01-2-C",
        "HCM-Z99-1-A",
        "HCM-QC01",
        "HCM-OFFICE",
      ]),
    ).toEqual({
      unknown: ["HCM-NOPE", "HCM-OFFICE"],
      inactive: ["HCM-A01-2-C", "HCM-Z99-1-A", "HCM-QC01"],
    });
  });
});
