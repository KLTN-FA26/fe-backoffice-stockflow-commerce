import { describe, expect, it } from "vitest";

import {
  RESERVATION_RELEASE_REASONS,
  RESERVATION_STATUSES,
  STOCK_ALERT_KINDS,
  STOCK_STATUSES,
} from "@/constants/inventory";

import {
  atpDto,
  reservationPageDto,
  reservationRowDto,
  stockAlertDto,
  stockAlertListInput,
  stockLevelsDto,
  warehouseStockItemDto,
  warehouseStockItemsInput,
} from "./stock-schemas";

// Fixtures follow backend develop 0f18f24 response records. Jackson NON_NULL omits nulls.
const level = {
  sku: "CUP-PP-500",
  warehouseCode: "HN01",
  onHand: 423,
  available: 350,
  reserved: 25,
  allocated: 0,
  atp: 330,
};

const stockItem = {
  stockItemId: "0e380000-0000-4000-8000-000000000001",
  sku: "CUP-PP-500",
  locationCode: "HN01-A01-01-A",
  lotNumber: "L2601",
  expiryDate: "2026-11-05",
  onHand: 120,
  reserved: 20,
  available: 100,
  status: "AVAILABLE",
  receivedAt: "2026-08-01T02:00:00Z",
};

const reservation = {
  reservationId: "0e380000-0000-4000-8000-000000000101",
  orderId: "0e380000-0000-4000-8000-000000000201",
  stockItemId: "0e380000-0000-4000-8000-000000000001",
  sku: "CUP-PP-500",
  locationCode: "HN01-A01-01-A",
  quantity: 20,
  status: "HELD",
  reservedAt: "2026-10-14T02:00:00Z",
};

const reorderAlert = {
  id: "0e380000-0000-4000-8000-000000000301",
  kind: "REORDER",
  sku: "CUP-PP-500",
  observedQty: 430,
  thresholdQty: 500,
  reservationImpaired: false,
  status: "OPEN",
  openedAt: "2026-10-15T01:00:00Z",
  lastObservedAt: "2026-10-16T01:00:00Z",
  version: 0,
};

function page<T>(items: T[]) {
  return {
    items,
    page: 0,
    size: 20,
    totalElements: items.length,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  };
}

describe("StockLevelResponse", () => {
  it("keeps every backend quantity exactly as sent, ATP included", () => {
    expect(stockLevelsDto.parse([level])).toEqual([level]);
  });

  it("does not reconcile quantities: atp is not available - reserved", () => {
    // HN01 in the backend roll-up: reserved on an expired lot is not subtracted from ATP.
    const [parsed] = stockLevelsDto.parse([level]);
    expect(parsed?.atp).toBe(330);
    expect(parsed?.atp).not.toBe(level.available - level.reserved);
  });

  it("rejects non-integer quantities", () => {
    expect(stockLevelsDto.safeParse([{ ...level, onHand: 1.5 }]).success).toBe(false);
    expect(stockLevelsDto.safeParse([{ ...level, atp: "330" }]).success).toBe(false);
  });
});

describe("WarehouseStockItemResponse", () => {
  it.each(STOCK_STATUSES)("parses status %s", (status) => {
    expect(warehouseStockItemDto.parse({ ...stockItem, status }).status).toBe(status);
  });

  it("accepts omitted lot, expiry and receivedAt (NON_NULL)", () => {
    const { lotNumber: _lot, expiryDate: _expiry, receivedAt: _received, ...bare } = stockItem;
    const parsed = warehouseStockItemDto.parse(bare);
    expect(parsed.lotNumber).toBeUndefined();
    expect(parsed.expiryDate).toBeUndefined();
    expect(parsed.receivedAt).toBeUndefined();
  });

  it("accepts explicit nulls for the same fields", () => {
    expect(
      warehouseStockItemDto.parse({
        ...stockItem,
        lotNumber: null,
        expiryDate: null,
        receivedAt: null,
      }).expiryDate,
    ).toBeNull();
  });

  it("reads expiry as a LocalDate and receivedAt as an Instant", () => {
    expect(
      warehouseStockItemDto.safeParse({ ...stockItem, expiryDate: "05/11/2026" }).success,
    ).toBe(false);
    expect(
      warehouseStockItemDto.safeParse({ ...stockItem, receivedAt: "2026-08-01" }).success,
    ).toBe(false);
  });

  it("does not invent UI fields", () => {
    const parsed = warehouseStockItemDto.parse({
      ...stockItem,
      condition: "GOOD",
      productName: "x",
    });
    expect(parsed).not.toHaveProperty("condition");
    expect(parsed).not.toHaveProperty("productName");
  });
});

describe("ATP", () => {
  it("is a bare integer and zero is a valid answer", () => {
    expect(atpDto.parse(0)).toBe(0);
    expect(atpDto.parse(330)).toBe(330);
    expect(atpDto.safeParse(null).success).toBe(false);
    expect(atpDto.safeParse({ quantity: 1 }).success).toBe(false);
  });
});

describe("ReservationRowResponse", () => {
  it.each(RESERVATION_STATUSES)("parses status %s", (status) => {
    expect(reservationRowDto.parse({ ...reservation, status }).status).toBe(status);
  });

  it.each(RESERVATION_RELEASE_REASONS)("parses release reason %s", (releaseReason) => {
    const released = {
      ...reservation,
      status: "RELEASED",
      releaseReason,
      closedAt: "2026-10-15T00:00:00Z",
    };
    expect(reservationRowDto.parse(released).releaseReason).toBe(releaseReason);
  });

  it("accepts an omitted lot, expiresAt, releaseReason and closedAt on a pinned live hold", () => {
    const parsed = reservationRowDto.parse(reservation);
    expect(parsed.expiresAt).toBeUndefined();
    expect(parsed.releaseReason).toBeUndefined();
    expect(parsed.closedAt).toBeUndefined();
    expect(parsed).not.toHaveProperty("orderNumber");
  });

  it("parses a zero-based page", () => {
    expect(reservationPageDto.parse(page([reservation])).page).toBe(0);
  });
});

describe("StockAlertResponse", () => {
  it.each(STOCK_ALERT_KINDS)("parses kind %s", (kind) => {
    expect(stockAlertDto.parse({ ...reorderAlert, kind }).kind).toBe(kind);
  });

  it("parses an SKU-wide low-stock alert with no warehouse, lot or expiry", () => {
    const parsed = stockAlertDto.parse(reorderAlert);
    expect(parsed.warehouseId).toBeUndefined();
    expect(parsed.daysToExpiry).toBeUndefined();
    expect(parsed.thresholdQty).toBe(500);
  });

  it("parses an expiry alert with warehouse, lot, expiry date and days to expiry", () => {
    const parsed = stockAlertDto.parse({
      ...reorderAlert,
      kind: "EXPIRED",
      warehouseId: "WH-HN-01",
      warehouseCode: "HN01",
      lotNumber: "L2599",
      expiryDate: "2026-10-01",
      daysToExpiry: -15,
      thresholdQty: undefined,
      reservationImpaired: true,
    });
    expect(parsed).toMatchObject({ warehouseCode: "HN01", lotNumber: "L2599", daysToExpiry: -15 });
  });
});

describe("request inputs", () => {
  it("normalises the exact SKU and drops blank filters", () => {
    expect(
      warehouseStockItemsInput.parse({
        warehouseId: "WH-HN-01",
        sku: "  cup-pp-500 ",
        location: " ",
        page: 0,
        size: 20,
      }),
    ).toEqual({
      warehouseId: "WH-HN-01",
      sku: "CUP-PP-500",
      location: undefined,
      lot: undefined,
      status: undefined,
      page: 0,
      size: 20,
      sort: undefined,
    });
  });

  it("comma-joins list filters and formats the sort clause", () => {
    const parsed = warehouseStockItemsInput.parse({
      warehouseId: "WH-HN-01",
      status: ["AVAILABLE", "EXPIRED"],
      sort: { field: "expiryDate", direction: "asc" },
      page: 0,
      size: 20,
    });
    expect(parsed.status).toBe("AVAILABLE,EXPIRED");
    expect(parsed.sort).toBe("expiryDate,asc");
  });

  it("refuses values the backend would reject or treat as match-nothing", () => {
    const base = { page: 0, size: 20 };
    expect(stockAlertListInput.safeParse({ ...base, kind: [] }).success).toBe(false);
    expect(stockAlertListInput.safeParse({ ...base, kind: ["LOW"] }).success).toBe(false);
    expect(
      warehouseStockItemsInput.safeParse({
        ...base,
        warehouseId: "WH-HN-01",
        sort: { field: "productName", direction: "asc" },
      }).success,
    ).toBe(false);
  });
});
