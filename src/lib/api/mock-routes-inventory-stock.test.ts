/**
 * Mock đọc tồn kho (SCRUM-438) — chạy qua axios thật + `features/inventory/api.ts` +
 * `transport.ts`, tức đúng đường mà màn hình dùng với BE thật: cùng URL, envelope, trang 0,
 * NON_NULL, lỗi `errorCode` → ApiError. `Math.random` cố định 0.05 → không dính lỗi 500 ngẫu nhiên.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { INVENTORY_API } from "@/constants/inventory";

import { api } from "@/lib/api/client";
import { warehouses } from "@/lib/mock-data";

import {
  getAtp,
  getStockLevels,
  listReservations,
  listStockAlerts,
  listWarehouseStockItems,
} from "@/features/inventory/api";
import { inventoryRequest } from "@/features/inventory/transport";

import { activateMockAdapter, resolveMockRoute } from "./mock-adapter";
import { MOCK_STOCK_WAREHOUSES } from "./mock-routes-inventory-stock-data";

import { z } from "zod";

// Mỗi request mock trễ ~215ms (Math.random = 0.05).
vi.setConfig({ testTimeout: 20_000 });

const originalAdapter = api.defaults.adapter;

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});

afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("route table", () => {
  it("does not let a broader stock-item route swallow ATP", async () => {
    await getAtp({ sku: "CUP-PP-500", warehouse: "HN01" }); // routes are registered lazily
    const atp = resolveMockRoute("GET", `${INVENTORY_API.atp}?sku=CUP-PP-500`);
    const items = resolveMockRoute("GET", INVENTORY_API.warehouseStockItems("WH-HN-01"));
    expect(atp).not.toBeNull();
    expect(items?.params).toEqual({ id: "WH-HN-01" });
    expect(atp?.handler).not.toBe(items?.handler);
    expect(resolveMockRoute("GET", "/inventory/stock-items")).toBeNull();
  });

  it("uses the warehouses of the mock warehouse directory", () => {
    for (const warehouse of MOCK_STOCK_WAREHOUSES) {
      expect(warehouses).toContainEqual(expect.objectContaining(warehouse));
    }
  });
});

describe("stock levels", () => {
  it("answers the exact SKU per warehouse, ordered by warehouse code", async () => {
    const levels = await getStockLevels({ sku: "cup-pp-500" });
    expect(levels.map((level) => level.warehouseCode)).toEqual(["HCM01", "HN01"]);
    expect(levels[1]).toEqual({
      sku: "CUP-PP-500",
      warehouseCode: "HN01",
      onHand: 423,
      available: 350,
      reserved: 25,
      allocated: 0,
      atp: 330,
    });
  });

  it("answers an unknown SKU with an empty list and a missing SKU with VALIDATION_FAILED", async () => {
    await expect(getStockLevels({ sku: "NO-SUCH-SKU" })).resolves.toEqual([]);
    await expect(
      inventoryRequest({ url: INVENTORY_API.stockLevels }, z.unknown()),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION_FAILED" });
  });
});

describe("warehouse stock items", () => {
  const base = { warehouseId: "WH-HN-01", sku: "CUP-PP-500", page: 0, size: 3 } as const;

  it("pages from zero with backend page metadata, leaving empty rows out by default", async () => {
    const first = await listWarehouseStockItems(base);
    expect(first).toMatchObject({
      page: 0,
      size: 3,
      totalElements: 6,
      totalPages: 2,
      hasNext: true,
      hasPrevious: false,
    });
    const second = await listWarehouseStockItems({ ...base, page: 1 });
    expect(second.items).toHaveLength(3);
    expect(second.hasNext).toBe(false);
    const withEmpty = await listWarehouseStockItems({ ...base, includeEmpty: true });
    expect(withEmpty.totalElements).toBe(7);
  });

  it("sorts by expiry date on the server, rows without expiry last", async () => {
    const page = await listWarehouseStockItems({
      ...base,
      size: 20,
      sort: { field: "expiryDate", direction: "asc" },
    });
    expect(page.items.map((item) => item.expiryDate ?? null)).toEqual([
      "2026-09-15",
      "2026-10-01",
      "2026-11-05",
      "2027-03-01",
      "2027-06-01",
      null,
    ]);
  });

  it("filters by status and omits null fields like Jackson NON_NULL", async () => {
    const page = await listWarehouseStockItems({ ...base, size: 20, status: ["AVAILABLE"] });
    expect(page.items.every((item) => item.status === "AVAILABLE")).toBe(true);
    const unlotted = page.items.find((item) => item.locationCode === "HN01-A02-01-A");
    expect(unlotted).toBeDefined();
    expect(unlotted).not.toHaveProperty("lotNumber");
    expect(unlotted).not.toHaveProperty("expiryDate");
    expect(unlotted).not.toHaveProperty("receivedAt");
  });

  it("answers an unknown warehouse with WAREHOUSE_NOT_FOUND", async () => {
    await expect(
      listWarehouseStockItems({ ...base, warehouseId: "WH-NONE" }),
    ).rejects.toMatchObject({ status: 404, code: "WAREHOUSE_NOT_FOUND" });
  });
});

describe("ATP", () => {
  it("returns the warehouse figure as an integer, zero included", async () => {
    await expect(getAtp({ sku: "CUP-PP-500", warehouse: "HN01" })).resolves.toBe(330);
    await expect(getAtp({ sku: "CUP-PP-500", warehouse: "HCM01" })).resolves.toBe(0);
    await expect(getAtp({ sku: "NO-SUCH-SKU", warehouse: "HN01" })).resolves.toBe(0);
  });
});

describe("reservations", () => {
  it("pages newest first and filters by status and warehouse code", async () => {
    const held = await listReservations({ status: ["HELD"], page: 0, size: 20 });
    expect(held.items.map((item) => item.status)).toEqual(["HELD", "HELD", "HELD", "HELD"]);
    expect(held.items.map((item) => item.reservedAt)).toEqual(
      [...held.items.map((item) => item.reservedAt)].sort().reverse(),
    );
    const hcm = await listReservations({ warehouse: "HCM01", page: 0, size: 20 });
    expect(hcm.items.map((item) => item.locationCode)).toEqual(["HCM01-B01-01-A"]);
    const paged = await listReservations({ page: 1, size: 5 });
    expect(paged).toMatchObject({ page: 1, totalElements: 7, hasPrevious: true });
  });

  it("omits null release data on live holds", async () => {
    const page = await listReservations({ sku: "CUP-PP-500", status: ["HELD"], page: 0, size: 20 });
    expect(page.items[0]).not.toHaveProperty("releaseReason");
    expect(page.items[0]).not.toHaveProperty("closedAt");
  });
});

describe("alerts", () => {
  it("returns SKU-wide low-stock alerts without a warehouse", async () => {
    const page = await listStockAlerts({ kind: ["REORDER", "SAFETY"], page: 0, size: 20 });
    expect(page.items.map((alert) => alert.kind).sort()).toEqual(["REORDER", "SAFETY"]);
    expect(page.items.every((alert) => alert.warehouseId === undefined)).toBe(true);
  });

  it("returns open expiry alerts of one SKU and warehouse with lot, date and days left", async () => {
    const page = await listStockAlerts({
      kind: ["EXPIRING", "EXPIRED"],
      status: ["OPEN", "ACKNOWLEDGED"],
      sku: "cup-pp-500",
      warehouseId: "WH-HN-01",
      page: 0,
      size: 20,
    });
    expect(
      page.items.map(({ kind, lotNumber, daysToExpiry }) => [kind, lotNumber, daysToExpiry]),
    ).toEqual([
      ["EXPIRING", "L2601", 20],
      ["EXPIRED", "L2599", -15],
    ]);
  });
});
