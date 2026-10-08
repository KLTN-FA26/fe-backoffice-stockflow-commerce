import { afterEach, describe, expect, it, vi } from "vitest";

import * as fixtures from "./fixtures";
import { createInventoryMockService } from "./mock-service";

afterEach(() => vi.restoreAllMocks());

describe("Inventory mock service boundaries", () => {
  it("loads only stock levels for the overview without constructing other panel data", async () => {
    const stockItems = vi.spyOn(fixtures, "createStockItemsFixture");
    const reservations = vi.spyOn(fixtures, "createReservationsFixture");
    const overview = await createInventoryMockService().loadOverview();

    expect(Object.keys(overview)).toEqual(["stockLevels"]);
    expect(overview.stockLevels).toHaveLength(24);
    expect(stockItems).not.toHaveBeenCalled();
    expect(reservations).not.toHaveBeenCalled();
  });

  it("returns stock items, ATP and reservations through their own methods", async () => {
    const service = createInventoryMockService();
    const items = await service.loadStockItems("DEMO-SKU-001", "DEMO-WH");
    expect(items.map((row) => row.id)).toEqual(["demo-item-1", "demo-item-2", "demo-item-3"]);
    expect(await service.loadStockItems("DEMO-SKU-001", "DEMO-NORTH")).toEqual([]);

    expect(await service.lookupAtp({ sku: "DEMO-SKU-001", warehouseCode: "DEMO-WH" })).toEqual({
      sku: "DEMO-SKU-001",
      warehouseCode: "DEMO-WH",
      quantity: 20,
    });
    expect(await service.lookupAtp({ sku: "UNKNOWN-SKU", warehouseCode: "DEMO-WH" })).toBeNull();
    expect((await service.loadReservations()).map((row) => row.id)).toEqual([
      "demo-reservation-1",
      "demo-reservation-2",
    ]);
  });
});
