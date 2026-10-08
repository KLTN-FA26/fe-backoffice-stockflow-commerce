import { describe, expect, it } from "vitest";

import { createInventoryFixture } from "./fixtures";
import { selectStockLevels } from "./stock-levels";

const rows = createInventoryFixture().stockLevels;

describe("mock stock-level projection", () => {
  it("matches SKU or product name and warehouse without changing quantity values", () => {
    const result = selectStockLevels(rows, {
      query: "sản phẩm minh họa 2",
      warehouseCode: "DEMO-NORTH",
      page: 1,
      size: 10,
    });
    expect(result.rows.map((row) => row.sku)).toEqual(["DEMO-SKU-021", "DEMO-SKU-024"]);
    expect(result.rows[0].available).toBe(29);
  });

  it("paginates all matches and clamps stale page numbers", () => {
    const first = selectStockLevels(rows, { query: "", warehouseCode: "all", page: 1, size: 10 });
    const last = selectStockLevels(rows, { query: "", warehouseCode: "all", page: 99, size: 10 });
    expect(first).toMatchObject({ totalElements: 24, totalPages: 3, page: 1 });
    expect(first.rows).toHaveLength(10);
    expect(last).toMatchObject({ page: 3 });
    expect(last.rows).toHaveLength(4);
  });
});
