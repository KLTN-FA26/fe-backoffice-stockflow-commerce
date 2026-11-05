import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  INVENTORY_LABELS,
  INVENTORY_MESSAGES,
  STOCK_ALERT_KIND_LABELS,
} from "@/constants/inventory";
import { INVENTORY_OVERVIEW_PERMISSIONS, WAREHOUSE_PERMISSIONS } from "@/constants/permissions";

import {
  OVERVIEW_RESERVATION,
  OVERVIEW_STOCK_ITEMS,
  OVERVIEW_WAREHOUSE,
  inventoryPermissions,
  overviewAlert,
  overviewHandlers,
  overviewPage,
  renderInventory,
  setInventoryTestActor,
} from "../test-support";
import { InventoryOverview } from "./InventoryOverview";

const ALL = [...Object.values(INVENTORY_OVERVIEW_PERMISSIONS), WAREHOUSE_PERMISSIONS.read];
const server = setupServer();
const sent: URL[] = [];
const sentTo = (path: string) =>
  sent.filter((url) => url.pathname.replace("/api/backend", "").startsWith(path));
const stockItemsPath = `/inventory/warehouses/${OVERVIEW_WAREHOUSE.id}/stock-items`;

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  server.events.on("request:start", ({ request }) => sent.push(new URL(request.url)));
});
beforeEach(() => setInventoryTestActor("Warehouse Manager"));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sent.length = 0;
});
afterAll(() => server.close());

async function openFor(sku: string, overrides: Parameters<typeof overviewHandlers>[0] = {}) {
  server.use(inventoryPermissions(ALL), ...overviewHandlers(overrides));
  renderInventory(<InventoryOverview />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(INVENTORY_LABELS.skuLookup), `${sku}{Enter}`);
  return user;
}

const region = (name: string | RegExp) => screen.findByRole("region", { name });
const levelsRegion = () => region(INVENTORY_LABELS.stockLevelsTitle);

async function openWarehouse(user: ReturnType<typeof userEvent.setup>, code: string) {
  await user.click(
    await screen.findByRole("button", { name: `${INVENTORY_LABELS.viewWarehouse} ${code}` }),
  );
}

describe("stock levels", () => {
  it("shows every backend quantity as received, with no pager", async () => {
    await openFor("CUP-PP-500");
    const levels = await levelsRegion();
    const row = (await within(levels).findByText("HN01")).closest("tr");
    expect(row).not.toBeNull();
    // atp 330 is the backend's figure: not available − reserved (350 − 25).
    expect(
      within(row as HTMLElement)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["HN01", "423", "350", "25", "0", "330", INVENTORY_LABELS.viewWarehouse]);
    expect(within(levels).queryByLabelText(INVENTORY_LABELS.perPage)).toBeNull();
  });

  it("treats an unknown SKU's empty list as an empty state", async () => {
    await openFor("NO-SUCH-SKU", { levels: [] });
    expect(await screen.findByText(INVENTORY_LABELS.noStockLevels)).toBeInTheDocument();
  });

  it("shows the inventory error for a failed read", async () => {
    await openFor("CUP-PP-500", {
      levels: HttpResponse.json(
        { success: false, errorCode: "INTERNAL_ERROR", correlationId: "trace-1" },
        { status: 500 },
      ),
    });
    const levels = await levelsRegion();
    expect(await within(levels).findByText(INVENTORY_LABELS.loadError)).toBeInTheDocument();
    expect(within(levels).getByText(/trace-1/)).toBeInTheDocument();
  });
});

describe("warehouse identity", () => {
  it("resolves the code through the directory: id to stock items, code to ATP", async () => {
    const user = await openFor("CUP-PP-500");
    await openWarehouse(user, "HN01");
    await waitFor(() => expect(sentTo(stockItemsPath)).toHaveLength(1));
    expect(Object.fromEntries(sentTo(stockItemsPath)[0]?.searchParams ?? [])).toEqual({
      sku: "CUP-PP-500",
      page: "0",
      size: "15",
      sort: "expiryDate,asc",
    });
    await waitFor(() => expect(sentTo("/inventory/stock-items/atp")).toHaveLength(1));
    expect(Object.fromEntries(sentTo("/inventory/stock-items/atp")[0]?.searchParams ?? [])).toEqual(
      { sku: "CUP-PP-500", warehouse: "HN01" },
    );
  });

  it("a code missing from the directory sends neither the stock-item nor the ATP read", async () => {
    const user = await openFor("CUP-PP-500");
    await openWarehouse(user, "HCM01");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      `${INVENTORY_LABELS.warehouseUnresolved}: HCM01`,
    );
    expect(sentTo("/inventory/warehouses")).toEqual([]);
    expect(sentTo("/inventory/stock-items/atp")).toEqual([]);
  });

  it("a directory that cannot be read invents no identity", async () => {
    const user = await openFor("CUP-PP-500", {
      directory: HttpResponse.json({ success: false, errorCode: "FORBIDDEN" }, { status: 403 }),
    });
    await openWarehouse(user, "HN01");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      INVENTORY_LABELS.directoryUnavailable,
    );
    expect(screen.getByText("HN01", { selector: "td" })).toBeInTheDocument();
    expect(sentTo("/inventory/warehouses")).toEqual([]);
    expect(sentTo("/inventory/stock-items/atp")).toEqual([]);
  });
});

describe("warehouse stock items", () => {
  it("keeps the server's row order and shows missing optional fields as a dash", async () => {
    // Deliberately not in expiry order: the page must not re-sort what the server returned.
    const reversed = [OVERVIEW_STOCK_ITEMS[1], OVERVIEW_STOCK_ITEMS[0]];
    const user = await openFor("CUP-PP-500", { items: overviewPage(reversed) });
    await openWarehouse(user, "HN01");
    const items = await region(/Tồn theo vị trí và lô/);
    const rows = await within(items).findAllByRole("row");
    expect(rows[1]).toHaveTextContent("HN01-A02-01-A");
    expect(rows[2]).toHaveTextContent("HN01-A01-02-B");
    expect(within(rows[1] as HTMLElement).getAllByText(INVENTORY_LABELS.missing)).toHaveLength(3);
  });

  it("pages on the server from zero and returns to the first page on a new page size", async () => {
    const user = await openFor("CUP-PP-500", {
      items: overviewPage(OVERVIEW_STOCK_ITEMS, {
        totalElements: 20,
        totalPages: 2,
        hasNext: true,
      }),
    });
    await openWarehouse(user, "HN01");
    const items = await region(/Tồn theo vị trí và lô/);
    await user.click(await within(items).findByRole("button", { name: INVENTORY_LABELS.next }));
    await waitFor(() => expect(sentTo(stockItemsPath).at(-1)?.searchParams.get("page")).toBe("1"));
    await user.selectOptions(within(items).getByLabelText(INVENTORY_LABELS.perPage), "50");
    await waitFor(() =>
      expect(Object.fromEntries(sentTo(stockItemsPath).at(-1)?.searchParams ?? [])).toMatchObject({
        page: "0",
        size: "50",
      }),
    );
  });
});

describe("ATP", () => {
  it("renders zero as a value", async () => {
    const user = await openFor("CUP-PP-500", { atp: 0 });
    await openWarehouse(user, "HN01");
    const atp = await region(/ATP — có thể hứa bán/);
    expect(await within(atp).findByText("0")).toBeInTheDocument();
    expect(within(atp).getByText(INVENTORY_LABELS.atpZero)).toBeInTheDocument();
  });

  it("is never asked for before a warehouse is chosen", async () => {
    await openFor("CUP-PP-500");
    await levelsRegion();
    await screen.findByText("HN01");
    expect(sentTo("/inventory/stock-items/atp")).toEqual([]);
  });
});

describe("reservations", () => {
  it("shows the backend order id and dashes for omitted fields, and pages on the server", async () => {
    const user = await openFor("CUP-PP-500", {
      reservations: overviewPage([OVERVIEW_RESERVATION], {
        totalElements: 16,
        totalPages: 2,
        hasNext: true,
      }),
    });
    const holds = await region(INVENTORY_LABELS.reservationsTitle);
    const row = (await within(holds).findByText(OVERVIEW_RESERVATION.orderId)).closest("tr");
    expect(within(row as HTMLElement).getAllByText(INVENTORY_LABELS.missing)).toHaveLength(4);
    await user.click(within(holds).getByRole("button", { name: INVENTORY_LABELS.next }));
    await waitFor(() =>
      expect(sentTo("/inventory/reservations").at(-1)?.searchParams.get("page")).toBe("1"),
    );
  });

  it("offers the warehouse filter only once a warehouse is open, off by default", async () => {
    const user = await openFor("CUP-PP-500");
    const holds = await region(INVENTORY_LABELS.reservationsTitle);
    expect(within(holds).queryByRole("checkbox")).toBeNull();
    await openWarehouse(user, "HN01");
    const filter = await within(holds).findByRole("checkbox");
    expect(sentTo("/inventory/reservations").at(-1)?.searchParams.has("warehouse")).toBe(false);
    await user.click(filter);
    await waitFor(() =>
      expect(
        Object.fromEntries(sentTo("/inventory/reservations").at(-1)?.searchParams ?? []),
      ).toEqual({ sku: "CUP-PP-500", warehouse: "HN01", page: "0", size: "15" }),
    );
  });
});

describe("reservation warehouse filter lifecycle", () => {
  const HCM = {
    id: "0e380000-0000-4000-8000-0000000000a2",
    prefix: "HCM01",
    name: "Kho HCM",
    status: "ACTIVE",
  };
  const lastHolds = () =>
    Object.fromEntries(sentTo("/inventory/reservations").at(-1)?.searchParams ?? []);
  const paged = overviewPage([OVERVIEW_RESERVATION], {
    totalElements: 16,
    totalPages: 2,
    hasNext: true,
  });

  it("unticking drops the warehouse parameter again", async () => {
    const user = await openFor("CUP-PP-500");
    await openWarehouse(user, "HN01");
    const holds = await region(INVENTORY_LABELS.reservationsTitle);
    const filter = await within(holds).findByRole("checkbox");
    await user.click(filter);
    await waitFor(() => expect(lastHolds().warehouse).toBe("HN01"));
    await user.click(filter);
    await waitFor(() => expect(lastHolds()).toEqual({ sku: "CUP-PP-500", page: "0", size: "15" }));
  });

  it("opening another warehouse while narrowed follows it and returns to page 1", async () => {
    const user = await openFor("CUP-PP-500", {
      directory: { items: [OVERVIEW_WAREHOUSE, HCM] },
      reservations: paged,
    });
    await openWarehouse(user, "HN01");
    const holds = await region(INVENTORY_LABELS.reservationsTitle);
    await user.click(await within(holds).findByRole("checkbox"));
    await user.click(within(holds).getByRole("button", { name: INVENTORY_LABELS.next }));
    await waitFor(() => expect(lastHolds()).toMatchObject({ warehouse: "HN01", page: "1" }));
    await openWarehouse(user, "HCM01");
    await waitFor(() => expect(lastHolds()).toMatchObject({ warehouse: "HCM01", page: "0" }));
  });

  it("a new SKU leaves no warehouse filter behind", async () => {
    const user = await openFor("CUP-PP-500");
    await openWarehouse(user, "HN01");
    const holds = await region(INVENTORY_LABELS.reservationsTitle);
    await user.click(await within(holds).findByRole("checkbox"));
    await waitFor(() => expect(lastHolds().warehouse).toBe("HN01"));
    const input = screen.getByLabelText(INVENTORY_LABELS.skuLookup);
    await user.clear(input);
    await user.type(input, "LID-PP-90{Enter}");
    await waitFor(() => expect(lastHolds()).toEqual({ sku: "LID-PP-90", page: "0", size: "15" }));
    expect(
      within(await region(INVENTORY_LABELS.reservationsTitle)).queryByRole("checkbox"),
    ).toBeNull();
  });
});

describe("alerts", () => {
  it("shows SKU-level low stock from the backend, as text and not colour alone", async () => {
    await openFor("CUP-PP-500", {
      lowStock: overviewPage([overviewAlert("REORDER", { thresholdQty: 500 })]),
    });
    const levels = await levelsRegion();
    expect(await within(levels).findByText(STOCK_ALERT_KIND_LABELS.REORDER)).toBeInTheDocument();
    expect(within(levels).getByText(/Ngưỡng: 500/)).toBeInTheDocument();
    const query = sentTo("/inventory/alerts")[0]?.searchParams;
    expect(query?.get("kind")).toBe("REORDER,SAFETY");
    expect(query?.has("warehouseId")).toBe(false);
  });

  it("says there is no low-stock alert only when the server counts none", async () => {
    await openFor("CUP-PP-500");
    expect(await screen.findByText(INVENTORY_LABELS.noLowStockAlerts)).toBeInTheDocument();
  });

  it("does not read a later page's alerts as absent", async () => {
    await openFor("CUP-PP-500", {
      lowStock: overviewPage([overviewAlert("SAFETY")], {
        totalElements: 16,
        totalPages: 2,
        hasNext: true,
      }),
    });
    expect(await screen.findByText(STOCK_ALERT_KIND_LABELS.SAFETY)).toBeInTheDocument();
    expect(screen.queryByText(INVENTORY_LABELS.noLowStockAlerts)).toBeNull();
  });

  it("shows expiry alerts of the open warehouse with the backend's own days-to-expiry", async () => {
    const user = await openFor("CUP-PP-500", {
      expiry: overviewPage([
        overviewAlert("EXPIRED", {
          warehouseId: OVERVIEW_WAREHOUSE.id,
          warehouseCode: "HN01",
          lotNumber: "L2599",
          expiryDate: "2026-10-01",
          daysToExpiry: -15,
          reservationImpaired: true,
        }),
        // Far-off expiry still flagged EXPIRING: the page trusts the backend's kind, no own window.
        overviewAlert("EXPIRING", {
          warehouseId: OVERVIEW_WAREHOUSE.id,
          lotNumber: "L3000",
          expiryDate: "2030-01-01",
          daysToExpiry: 1173,
        }),
      ]),
    });
    await openWarehouse(user, "HN01");
    const expiry = await region(INVENTORY_LABELS.expiryAlertsTitle);
    expect(await within(expiry).findByText(STOCK_ALERT_KIND_LABELS.EXPIRED)).toBeInTheDocument();
    expect(within(expiry).getByText(/Số ngày đến hạn: -15/)).toBeInTheDocument();
    expect(within(expiry).getByText(/Số ngày đến hạn: 1173/)).toBeInTheDocument();
    expect(within(expiry).getByText(INVENTORY_LABELS.reservationImpaired)).toBeInTheDocument();
    const query = sentTo("/inventory/alerts").find((url) =>
      url.searchParams.get("kind")?.includes("EXPIRING"),
    );
    expect(query?.searchParams.get("warehouseId")).toBe(OVERVIEW_WAREHOUSE.id);
  });
});

it("invalid stock response shows a contract error rather than an empty result", async () => {
  await openFor("A", { levels: { items: [] } });
  expect(await screen.findByText(INVENTORY_MESSAGES.invalidContract)).toBeInTheDocument();
  expect(screen.queryByText(INVENTORY_LABELS.noStockLevels)).toBeNull();
});

it("unresolved warehouse codes cannot narrow reservation requests", async () => {
  const user = await openFor("CUP-PP-500");
  await openWarehouse(user, "HCM01");
  expect(await screen.findByRole("alert")).toHaveTextContent(INVENTORY_LABELS.warehouseUnresolved);
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(sentTo("/inventory/reservations").every((url) => !url.searchParams.has("warehouse"))).toBe(
    true,
  );
});

it("retries directory failure before permitting warehouse reads", async () => {
  const user = await openFor("CUP-PP-500", {
    directory: HttpResponse.json({ success: false }, { status: 500 }),
  });
  await openWarehouse(user, "HN01");
  expect(await screen.findByRole("alert")).toHaveTextContent(INVENTORY_LABELS.directoryUnavailable);
  expect(sentTo(stockItemsPath)).toHaveLength(0);
  server.use(...overviewHandlers());
  await user.click(screen.getByRole("button", { name: INVENTORY_LABELS.retry }));
  await waitFor(() => expect(sentTo(stockItemsPath)).toHaveLength(1));
});

describe("slots hidden during a cycle count (SCRUM-146)", () => {
  it("shows the badge instead of quantities for a masked row and numbers for the others", async () => {
    const masked = {
      stockItemId: "0e380000-0000-4000-8000-000000000009",
      sku: "CUP-PP-500",
      locationCode: "HN01-A03-01-A",
      status: "AVAILABLE",
      hiddenDuringCount: true,
    };
    const user = await openFor("CUP-PP-500", {
      items: overviewPage([...OVERVIEW_STOCK_ITEMS, masked]),
    });
    await openWarehouse(user, "HN01");
    const maskedRow = (await screen.findByText(masked.locationCode)).closest("tr");
    expect(maskedRow).not.toBeNull();
    expect(
      within(maskedRow as HTMLElement).getByText(INVENTORY_LABELS.hiddenDuringCount),
    ).toBeInTheDocument();
    expect(within(maskedRow as HTMLElement).queryByText(/^\d+$/)).toBeNull();
    const normalRow = screen.getByText("HN01-A02-01-A").closest("tr");
    expect(within(normalRow as HTMLElement).getAllByText("30").length).toBeGreaterThan(0);
    expect(screen.getAllByText(INVENTORY_LABELS.hiddenDuringCount)).toHaveLength(1);
  });
});
