import { describe, expect, it } from "vitest";

import { LAYOUT_40HC, LAYOUT_PICKUP_KIT, UNPLACED_40HC } from "../__fixtures__/layouts";

import { buildItemTable, itemKey } from "./item-rows";

describe("buildItemTable", () => {
  it("one row per item × nominal size with per-vehicle counts, in first-seen order", () => {
    const { rows, grandTotal } = buildItemTable([LAYOUT_40HC]);
    expect(rows.map((r) => [r.partName, r.perVehicle[1], r.loaded, r.total])).toEqual([
      ["Thùng sofa", 120, 120, 120],
      ["Ghế ăn", 96, 96, 96],
      ["Bàn trà", 40, 40, 40],
      ["Kệ sách", 14, 14, 14],
      ["Phụ kiện", 168, 168, 168],
    ]);
    expect(grandTotal).toBe(438);
  });

  it("adds unplaced quantities to the requested total of the matching row and keeps loaded as is", () => {
    const { rows, grandTotal } = buildItemTable([LAYOUT_40HC], UNPLACED_40HC);
    const table = rows.find((r) => r.partName === "Bàn trà");
    expect(table).toMatchObject({ loaded: 40, total: 52 });
    expect(grandTotal).toBe(438 + 12 + 3);
  });

  it("keeps a row for an item that was not placed at all, with its real name and size", () => {
    const { rows } = buildItemTable([LAYOUT_40HC], UNPLACED_40HC);
    expect(rows.at(-1)).toMatchObject({
      partName: "Tủ vải",
      label: "TV-F",
      loaded: 0,
      total: 3,
      perVehicle: {},
    });
  });

  it("the same code in two nominal sizes stays two rows", () => {
    const big = { ...UNPLACED_40HC[0], origMm: { l: 2000, w: 600, h: 500 } };
    const { rows } = buildItemTable([LAYOUT_40HC], [UNPLACED_40HC[0], big]);
    expect(rows.filter((r) => r.partName === "Bàn trà")).toHaveLength(2);
  });

  it("a rotated nominal size (same three sides) is the same row", () => {
    const rotated = { ...UNPLACED_40HC[0], origMm: { l: 600, w: 500, h: 1000 } };
    const { rows } = buildItemTable([LAYOUT_40HC], [rotated]);
    expect(rows.filter((r) => r.partName === "Bàn trà")).toHaveLength(1);
  });

  it("spreads one item over several vehicles", () => {
    const second = { ...LAYOUT_PICKUP_KIT, seq: 2 };
    const { rows } = buildItemTable([LAYOUT_PICKUP_KIT, second]);
    const top = rows.find((r) => r.partName === "Mặt bàn");
    expect(top).toMatchObject({ perVehicle: { 1: 4, 2: 4 }, loaded: 8, total: 8 });
  });

  it("is empty for no vehicles", () => {
    expect(buildItemTable([])).toEqual({ rows: [], grandTotal: 0 });
  });
});

describe("itemKey", () => {
  it("includes label, name and the sorted nominal sides", () => {
    expect(itemKey({ label: "A", partName: "B", origMm: { l: 3, w: 1, h: 2 } })).toBe("A|B|1|2|3");
  });
});
