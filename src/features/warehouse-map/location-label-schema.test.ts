import { describe, expect, it } from "vitest";

import { UI_LABELS, WAREHOUSE_MAP_LIMITS } from "@/constants";

import { LAYOUT } from "./__fixtures__/layout";
import { EMPTY_LOCATION_LABEL_FORM, locationLabelSchema } from "./location-label-schema";

import type { LocationLabelInput, WarehouseLayout } from "./types";

const PV = UI_LABELS.warehouseMap.print.validation;
const parse = (patch: Partial<LocationLabelInput>, layout: WarehouseLayout = LAYOUT) =>
  locationLabelSchema(layout).safeParse({ ...EMPTY_LOCATION_LABEL_FORM, ...patch });
const messages = (result: ReturnType<typeof parse>) =>
  result.success ? [] : result.error.issues.map((issue) => issue.message);

/** Kệ có `count` bin đang dùng trên một tầng — dựng từ kệ A01 của fixture. */
function layoutWithBins(count: number): WarehouseLayout {
  const shelf = LAYOUT.shelves[0];
  const level = shelf?.levels[0];
  const bin = level?.bins[0];
  if (!shelf || !level || !bin) throw new Error("fixture thiếu kệ A01");
  const bins = Array.from({ length: count }, (_, i) => ({
    ...bin,
    id: `b${i}`,
    locationCode: `HCM-A01-1-${i}`,
  }));
  return { ...LAYOUT, shelves: [{ ...shelf, levels: [{ ...level, bins }] }], areas: [] };
}

describe("locationLabelSchema → body LocationLabelRequest", () => {
  it("cả kho: không gửi selector nào, chỉ khổ nhãn", () => {
    const result = parse({ format: "THERMAL_ROLL" });
    expect(result.success && result.data).toEqual({ format: "THERMAL_ROLL" });
  });

  it("một kệ: chọn tầng thì gửi levelIndexes; không chọn tầng thì bỏ (BE @Size(min = 1))", () => {
    const withLevels = parse({ scope: "SHELF", shelfId: "shelf-a01", levelIndexes: [2] });
    expect(withLevels.success && withLevels.data).toEqual({
      format: "A4_SHEET",
      shelfId: "shelf-a01",
      levelIndexes: [2],
    });
    const allLevels = parse({ scope: "SHELF", shelfId: "shelf-a01", zoneId: "zone-a" });
    // Ô của phạm vi khác (zoneId) không lọt vào body — BE chỉ nhận một selector
    expect(allLevels.success && allLevels.data).toEqual({
      format: "A4_SHEET",
      shelfId: "shelf-a01",
    });
  });

  it("danh sách mã: chuẩn hoá chữ hoa, bỏ trùng", () => {
    const result = parse({ scope: "CODES", codesText: "hcm-a01-1-a\nHCM-RCV01, HCM-A01-1-A" });
    expect(result.success && result.data).toEqual({
      format: "A4_SHEET",
      locationCodes: ["HCM-A01-1-A", "HCM-RCV01"],
    });
  });

  it("phạm vi kệ / zone chưa chọn → lỗi tại ô", () => {
    expect(messages(parse({ scope: "SHELF" }))).toEqual([PV.shelfRequired]);
    expect(messages(parse({ scope: "ZONE" }))).toEqual([PV.zoneRequired]);
  });

  it("mã sai định dạng / kho không có / đã ngừng dùng → nêu đích danh mã", () => {
    expect(messages(parse({ scope: "CODES", codesText: "" }))).toEqual([PV.codesRequired]);
    expect(messages(parse({ scope: "CODES", codesText: "HCM_A01" }))).toEqual([
      PV.codesInvalid("HCM_A01"),
    ]);
    expect(messages(parse({ scope: "CODES", codesText: "HCM-X1" }))).toEqual([
      PV.codesUnknown("HCM-X1"),
    ]);
    const shelf = LAYOUT.shelves[0];
    if (!shelf) throw new Error("fixture thiếu kệ");
    const off = { ...LAYOUT, shelves: [{ ...shelf, status: "INACTIVE" as const }] };
    expect(messages(parse({ scope: "CODES", codesText: "HCM-A01-1-A" }, off))).toEqual([
      PV.codesInactive("HCM-A01-1-A"),
    ]);
  });

  it("BR-17 (docs 06 §4.3): đúng 2.000 nhãn thì qua, 2.001 nhãn bị chặn trước khi gửi", () => {
    const max = WAREHOUSE_MAP_LIMITS.labelsPerPrintMax;
    expect(parse({}, layoutWithBins(max)).success).toBe(true);
    expect(messages(parse({}, layoutWithBins(max + 1)))).toEqual([PV.tooMany]);
  });

  it("lựa chọn không còn vị trí đang dùng → báo trước (BE 422 LOCATION_LABELS_EMPTY)", () => {
    expect(messages(parse({ scope: "SHELF", shelfId: "shelf-z99" }))).toEqual([PV.empty]);
  });
});
