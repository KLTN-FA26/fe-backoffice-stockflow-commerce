import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { INVENTORY_API } from "@/constants/inventory";

import {
  getAtp,
  getStockLevels,
  listReservations,
  listStockAlerts,
  listWarehouseStockItems,
} from "./api";
import { inventoryEndpoint } from "./test-support";

// Requests go through the production client (same-origin BFF base path, `{ success, data }`
// unwrapping), so these assertions see the query string exactly as it leaves the browser.
const server = setupServer();
const emptyPage = {
  items: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
};

let seen: URL | null = null;
function answer(path: string, data: unknown) {
  server.use(
    http.get(inventoryEndpoint(path), ({ request }) => {
      seen = new URL(request.url);
      return HttpResponse.json({ success: true, data });
    }),
  );
}
function query() {
  return seen ? [...seen.searchParams.entries()] : null;
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  seen = null;
});
afterAll(() => server.close());

describe("getStockLevels", () => {
  it("sends only the trimmed, upper-cased SKU and validates the array", async () => {
    const level = {
      sku: "CUP-PP-500",
      warehouseCode: "HN01",
      onHand: 423,
      available: 350,
      reserved: 25,
      allocated: 0,
      atp: 330,
    };
    answer(INVENTORY_API.stockLevels, [level]);
    expect(await getStockLevels({ sku: "  cup-pp-500 " })).toEqual([level]);
    expect(seen?.pathname).toBe(`/api/backend${INVENTORY_API.stockLevels}`);
    expect(query()).toEqual([["sku", "CUP-PP-500"]]);
  });

  it("rejects a response that is not the backend array", async () => {
    answer(INVENTORY_API.stockLevels, { items: [] });
    await expect(getStockLevels({ sku: "CUP-PP-500" })).rejects.toMatchObject({
      code: "INVALID_INVENTORY_CONTRACT",
    });
  });
});

describe("listWarehouseStockItems", () => {
  it("puts the warehouse id in the path and sends zero-based paging, sort and comma lists", async () => {
    answer(INVENTORY_API.warehouseStockItems("WH-HN-01"), emptyPage);
    await listWarehouseStockItems({
      warehouseId: "WH-HN-01",
      sku: " cup-pp-500",
      status: ["AVAILABLE", "EXPIRED"],
      page: 0,
      size: 20,
      sort: { field: "expiryDate", direction: "asc" },
    });
    expect(seen?.pathname).toBe("/api/backend/inventory/warehouses/WH-HN-01/stock-items");
    expect(query()).toEqual([
      ["sku", "CUP-PP-500"],
      ["status", "AVAILABLE,EXPIRED"],
      ["page", "0"],
      ["size", "20"],
      ["sort", "expiryDate,asc"],
    ]);
    expect(seen?.search).not.toContain("status%5B%5D");
  });

  it("omits absent and blank filters instead of sending empty strings", async () => {
    answer(INVENTORY_API.warehouseStockItems("WH-HN-01"), emptyPage);
    await listWarehouseStockItems({
      warehouseId: "WH-HN-01",
      sku: "",
      location: "  ",
      page: 2,
      size: 50,
    });
    expect(query()).toEqual([
      ["page", "2"],
      ["size", "50"],
    ]);
  });

  it("sends includeEmpty and location only when asked", async () => {
    answer(INVENTORY_API.warehouseStockItems("WH-HN-01"), emptyPage);
    await listWarehouseStockItems({
      warehouseId: "WH-HN-01",
      location: "HN01-A01",
      lot: "L2601",
      includeEmpty: true,
      page: 0,
      size: 20,
    });
    expect(Object.fromEntries(seen?.searchParams ?? [])).toEqual({
      location: "HN01-A01",
      lot: "L2601",
      includeEmpty: "true",
      page: "0",
      size: "20",
    });
  });
});

describe("getAtp", () => {
  it("sends the normalised SKU with the given warehouse code and returns the integer", async () => {
    answer(INVENTORY_API.atp, 330);
    expect(await getAtp({ sku: "cup-pp-500", warehouse: "HN01" })).toBe(330);
    expect(seen?.pathname).toBe(`/api/backend${INVENTORY_API.atp}`);
    expect(query()).toEqual([
      ["sku", "CUP-PP-500"],
      ["warehouse", "HN01"],
    ]);
  });

  it("returns zero as a real answer, not as not-found", async () => {
    answer(INVENTORY_API.atp, 0);
    await expect(getAtp({ sku: "CUP-PP-500", warehouse: "HCM01" })).resolves.toBe(0);
  });
});

describe("listReservations", () => {
  it("sends SKU, warehouse code, comma-joined statuses, paging and the optional order id", async () => {
    answer(INVENTORY_API.reservations, emptyPage);
    const orderId = "0e380000-0000-4000-8000-000000000201";
    await listReservations({
      orderId,
      sku: "cup-pp-500",
      status: ["HELD", "RELEASED"],
      warehouse: "HN01",
      page: 1,
      size: 10,
    });
    expect(query()).toEqual([
      ["orderId", orderId],
      ["sku", "CUP-PP-500"],
      ["status", "HELD,RELEASED"],
      ["warehouse", "HN01"],
      ["page", "1"],
      ["size", "10"],
    ]);
  });

  it("omits the order id when absent", async () => {
    answer(INVENTORY_API.reservations, emptyPage);
    await listReservations({ page: 0, size: 20 });
    expect(query()).toEqual([
      ["page", "0"],
      ["size", "20"],
    ]);
  });
});

describe("listStockAlerts", () => {
  it("sends kinds, statuses, SKU, warehouse id, paging and sort as the backend binds them", async () => {
    answer(INVENTORY_API.alerts, emptyPage);
    await listStockAlerts({
      kind: ["EXPIRING", "EXPIRED"],
      status: ["OPEN", "ACKNOWLEDGED"],
      sku: "cup-pp-500",
      warehouseId: "WH-HN-01",
      page: 0,
      size: 20,
      sort: { field: "openedAt", direction: "desc" },
    });
    expect(query()).toEqual([
      ["kind", "EXPIRING,EXPIRED"],
      ["status", "OPEN,ACKNOWLEDGED"],
      ["sku", "CUP-PP-500"],
      ["warehouseId", "WH-HN-01"],
      ["page", "0"],
      ["size", "20"],
      ["sort", "openedAt,desc"],
    ]);
  });
});
