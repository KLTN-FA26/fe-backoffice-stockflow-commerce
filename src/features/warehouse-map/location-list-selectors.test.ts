import { describe, expect, it } from "vitest";

import { LAYOUT } from "./__fixtures__/layout";
import {
  EMPTY_LOCATION_FILTERS,
  filterLocationRows,
  locationFilterOptions,
  NO_ZONE,
  pageOfRows,
} from "./location-list-filters";
import { buildLocationRows } from "./location-list-selectors";

import type { WarehouseLayout } from "./types";

const STOCK = [
  {
    locationCode: "HCM-A01-1-A",
    sku: "SOFA-01",
    lotNumber: "L1",
    expiryDate: "2027-03-01",
    onHand: 10,
    reserved: 4,
  },
  {
    locationCode: "HCM-A01-1-A",
    sku: "SOFA-02",
    lotNumber: "L2",
    expiryDate: "2026-12-31",
    onHand: 5,
    reserved: 0,
  },
  { locationCode: "HCM-RCV01", sku: "CHAIR-9", onHand: 12, reserved: 0 },
];

const codes = (rows: { locationCode: string }[]) => rows.map((row) => row.locationCode);

describe("buildLocationRows — vị trí từ layout (docs 06)", () => {
  it("một dòng mỗi bin và mỗi khu vực có mã, sắp theo mã", () => {
    expect(codes(buildLocationRows(LAYOUT, null))).toEqual([
      "HCM-A01-1-A",
      "HCM-A01-1-B",
      "HCM-A01-2-A",
      "HCM-RCV01",
    ]);
  });

  it("bin mang zone, kệ, tầng, chiều cao lọt của tầng; trạng thái là effectiveStatus", () => {
    const [bin] = buildLocationRows(LAYOUT, null);
    expect(bin).toMatchObject({
      kind: "bin",
      placeId: "shelf-a01",
      zoneId: "zone-a",
      zoneName: "Khu A - Sofa",
      shelfCode: "A01",
      levelIndex: 1,
      usableHeight: 1.4,
      width: 5,
      length: 1.2,
      status: "ACTIVE",
      usable: true,
      binType: "PALLET",
      areaType: null,
    });
  });

  it("khu vực không có sức chứa (06 §4.6, 2026-11-13) và không thuộc kệ / zone", () => {
    const area = buildLocationRows(LAYOUT, null).find((row) => row.kind === "area");
    expect(area).toMatchObject({
      placeId: "area-rcv",
      areaType: "RECEIVING",
      capacityM3: null,
      shelfCode: null,
      levelIndex: null,
      zoneId: null,
    });
  });

  it("khu vực không có mã vị trí (NON_STORAGE) không được liệt kê — không quét được", () => {
    const layout: WarehouseLayout = {
      ...LAYOUT,
      areas: [
        ...LAYOUT.areas,
        { ...LAYOUT.areas[0]!, id: "area-x", type: "NON_STORAGE", locationCode: null },
      ],
    };
    expect(codes(buildLocationRows(layout, null))).not.toContain(null);
    expect(buildLocationRows(layout, null)).toHaveLength(4);
  });

  it("bin thuộc kệ ngừng dùng mang trạng thái kế thừa từ kệ", () => {
    const layout: WarehouseLayout = {
      ...LAYOUT,
      shelves: [
        {
          ...LAYOUT.shelves[0]!,
          levels: [
            {
              ...LAYOUT.shelves[0]!.levels[0]!,
              bins: [
                {
                  ...LAYOUT.shelves[0]!.levels[0]!.bins[0]!,
                  status: "ACTIVE",
                  effectiveStatus: "INACTIVE",
                  usable: false,
                },
              ],
            },
          ],
        },
      ],
    };
    expect(buildLocationRows(layout, null)[0]).toMatchObject({
      status: "INACTIVE",
      usable: false,
    });
  });
});

describe("buildLocationRows — hàng trong vị trí (docs 20 §4.1)", () => {
  it("không đọc được tồn → stock null (khác với vị trí trống)", () => {
    expect(buildLocationRows(LAYOUT, null).every((row) => row.stock === null)).toBe(true);
  });

  it("cộng tồn theo vị trí: SKU, lô, tồn, đang giữ, hạn dùng gần nhất", () => {
    const row = buildLocationRows(LAYOUT, STOCK)[0];
    expect(row?.stock).toEqual({
      skus: ["SOFA-01", "SOFA-02"],
      lots: ["L1", "L2"],
      onHand: 15,
      reserved: 4,
      nearestExpiry: "2026-12-31",
      hidden: false,
    });
  });

  it("vị trí không có dòng tồn là trống (0), không phải chưa biết", () => {
    const empty = buildLocationRows(LAYOUT, STOCK).find((r) => r.locationCode === "HCM-A01-1-B");
    expect(empty?.stock).toEqual({
      skus: [],
      lots: [],
      onHand: 0,
      reserved: 0,
      nearestExpiry: null,
      hidden: false,
    });
  });

  it("SCRUM-146: dòng đang kiểm kê ẩn số lượng → tổng của vị trí là null, cờ hidden", () => {
    const rows = buildLocationRows(LAYOUT, [
      { locationCode: "HCM-A01-1-A", sku: "SOFA-01", onHand: 10, reserved: 0 },
      { locationCode: "HCM-A01-1-A", sku: "SOFA-02", hiddenDuringCount: true },
    ]);
    expect(rows[0]?.stock).toMatchObject({
      skus: ["SOFA-01", "SOFA-02"],
      onHand: null,
      reserved: null,
      hidden: true,
    });
  });
});

describe("filterLocationRows", () => {
  const rows = buildLocationRows(LAYOUT, STOCK);
  const filter = (patch: Partial<typeof EMPTY_LOCATION_FILTERS>) =>
    codes(filterLocationRows(rows, { ...EMPTY_LOCATION_FILTERS, ...patch }));

  it("không lọc → giữ nguyên", () => {
    expect(filter({})).toHaveLength(4);
  });

  it("search chính khớp mã vị trí hoặc SKU, không phân biệt hoa thường, bỏ khoảng trắng", () => {
    expect(filter({ q: "  rcv01 " })).toEqual(["HCM-RCV01"]);
    expect(filter({ q: "sofa-02" })).toEqual(["HCM-A01-1-A"]);
  });

  it("search trong cột mã chỉ xét mã; cột SKU chỉ xét SKU", () => {
    expect(filter({ code: "sofa" })).toEqual([]);
    expect(filter({ code: "-2-" })).toEqual(["HCM-A01-2-A"]);
    expect(filter({ sku: "chair" })).toEqual(["HCM-RCV01"]);
  });

  it("lọc loại, zone (kể cả không thuộc zone), kệ, trạng thái", () => {
    expect(filter({ kind: "area" })).toEqual(["HCM-RCV01"]);
    expect(filter({ zone: NO_ZONE })).toEqual(["HCM-RCV01"]);
    expect(filter({ zone: "zone-a", shelf: "A01" })).toHaveLength(3);
    expect(filter({ status: "BLOCKED" })).toEqual(["HCM-A01-1-B"]);
  });

  it("lọc có hàng / trống", () => {
    expect(filter({ stock: "stocked" })).toEqual(["HCM-A01-1-A", "HCM-RCV01"]);
    expect(filter({ stock: "empty" })).toEqual(["HCM-A01-1-B", "HCM-A01-2-A"]);
  });

  it("chưa đọc được tồn → bỏ qua lọc có hàng / trống và lọc SKU thay vì trả rỗng sai", () => {
    const noStock = buildLocationRows(LAYOUT, null);
    const result = filterLocationRows(noStock, {
      ...EMPTY_LOCATION_FILTERS,
      stock: "empty",
      sku: "sofa",
    });
    expect(result).toHaveLength(4);
  });
});

describe("locationFilterOptions", () => {
  it("chỉ các zone / kệ / trạng thái có trong danh sách; nhóm không thuộc zone ở cuối", () => {
    expect(locationFilterOptions(buildLocationRows(LAYOUT, null))).toEqual({
      zones: [
        { value: "zone-a", label: "Khu A - Sofa" },
        { value: NO_ZONE, label: null },
      ],
      shelves: ["A01"],
      statuses: ["ACTIVE", "BLOCKED"],
    });
  });
});

describe("pageOfRows", () => {
  it("cắt đúng trang; trang vượt quá → trang cuối có dữ liệu", () => {
    const rows = buildLocationRows(LAYOUT, null);
    expect(codes(pageOfRows(rows, 1, 3).items)).toEqual(["HCM-RCV01"]);
    expect(pageOfRows(rows, 9, 3)).toMatchObject({ page: 1, totalPages: 2, total: 4 });
    expect(pageOfRows([], 0, 10)).toMatchObject({ page: 0, totalPages: 1, total: 0 });
  });
});
