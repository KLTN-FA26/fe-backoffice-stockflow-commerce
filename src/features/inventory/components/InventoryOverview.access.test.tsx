import { focusManager } from "@tanstack/react-query";
import { cleanup, act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_LABELS, INVENTORY_MESSAGES } from "@/constants/inventory";
import { INVENTORY_OVERVIEW_PERMISSIONS, WAREHOUSE_PERMISSIONS } from "@/constants/permissions";

import {
  OVERVIEW_RESERVATION,
  inventoryPermissions,
  overviewHandlers,
  renderInventory,
  setInventoryTestActor,
} from "../test-support";
import { InventoryOverview } from "./InventoryOverview";

import type { PermissionCode } from "@/lib/auth";

const { stockRead, reservationRead, alertRead } = INVENTORY_OVERVIEW_PERMISSIONS;
const warehouseRead = WAREHOUSE_PERMISSIONS.read;
const server = setupServer();
// Every request that left the page, as backend path + query (the BFF base path stripped).
const sent: string[] = [];
const sentTo = (path: string) => sent.filter((url) => url.startsWith(path));

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    sent.push(`${url.pathname.replace("/api/backend", "")}${url.search}`);
  });
});
beforeEach(() => setInventoryTestActor("Warehouse Staff"));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sent.length = 0;
});
afterAll(() => server.close());

function open(permissions: PermissionCode[]) {
  server.use(inventoryPermissions(permissions), ...overviewHandlers());
  renderInventory(<InventoryOverview />);
}

async function lookUp(sku: string) {
  const user = userEvent.setup();
  const input = await screen.findByLabelText(INVENTORY_LABELS.skuLookup);
  await user.clear(input);
  await user.type(input, `${sku}{Enter}`);
  return user;
}

describe("Inventory Overview access", () => {
  it("stock-only: opens, shows stock and never asks for reservations", async () => {
    open([stockRead]);
    await lookUp("CUP-PP-500");
    expect(
      await screen.findByRole("heading", { name: INVENTORY_LABELS.stockLevelsTitle }),
    ).toBeInTheDocument();
    expect(await screen.findByText("HN01")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: INVENTORY_LABELS.reservationsTitle })).toBeNull();
    expect(sentTo("/inventory/reservations")).toEqual([]);
  });

  it("reservation-only: opens and reads holds by SKU without any stock, ATP or alert request", async () => {
    open([reservationRead]);
    await lookUp("CUP-PP-500");
    expect(await screen.findByText(OVERVIEW_RESERVATION.orderId)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: INVENTORY_LABELS.stockLevelsTitle })).toBeNull();
    expect(sentTo("/inventory/reservations")[0]).toContain("sku=CUP-PP-500");
    for (const path of [
      "/inventory/stock-levels",
      "/inventory/warehouses",
      "/inventory/stock-items",
      "/inventory/alerts",
      "/warehouses",
    ]) {
      expect(sentTo(path)).toEqual([]);
    }
  });

  it("both: shows the stock and the reservation sections", async () => {
    open([stockRead, reservationRead]);
    await lookUp("CUP-PP-500");
    expect(
      await screen.findByRole("heading", { name: INVENTORY_LABELS.stockLevelsTitle }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: INVENTORY_LABELS.reservationsTitle }),
    ).toBeInTheDocument();
  });

  it("alert READ alone does not open the page", async () => {
    open([alertRead]);
    expect(await screen.findByText(INVENTORY_LABELS.denied)).toBeInTheDocument();
    expect(screen.queryByLabelText(INVENTORY_LABELS.skuLookup)).toBeNull();
    expect(sent.filter((url) => url.startsWith("/inventory"))).toEqual([]);
    expect(sentTo("/warehouses")).toEqual([]);
  });

  it("stock without alert READ: no alert request, and says alerts are unavailable — not absent", async () => {
    open([stockRead]);
    await lookUp("CUP-PP-500");
    expect(await screen.findByText(INVENTORY_LABELS.alertsUnavailable)).toBeInTheDocument();
    expect(screen.queryByText(INVENTORY_LABELS.noLowStockAlerts)).toBeNull();
    expect(sentTo("/inventory/alerts")).toEqual([]);
  });
});

describe("warehouse directory authorization", () => {
  const openHn01 = async () => {
    const user = await lookUp("CUP-PP-500");
    await user.click(
      await screen.findByRole("button", { name: `${INVENTORY_LABELS.viewWarehouse} HN01` }),
    );
    return user;
  };

  it("stock READ without warehouse READ (QC): levels only — no directory, stock-item or ATP read", async () => {
    open([stockRead]);
    await openHn01();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      `${INVENTORY_LABELS.directoryForbidden}: HN01`,
    );
    expect(screen.getByText("HN01", { selector: "td" })).toBeInTheDocument();
    expect(sentTo("/inventory/stock-levels")).toHaveLength(1);
    expect(sentTo("/warehouses")).toEqual([]);
    expect(sentTo("/inventory/warehouses")).toEqual([]);
    expect(sentTo("/inventory/stock-items/atp")).toEqual([]);
  });

  it("stock + warehouse READ: directory resolves the code, stock items by id, ATP by code", async () => {
    open([stockRead, warehouseRead]);
    await openHn01();
    await waitFor(() => expect(sentTo("/inventory/stock-items/atp")).toHaveLength(1));
    expect(sentTo("/warehouses")).toHaveLength(1);
    expect(
      sentTo("/inventory/warehouses/0e380000-0000-4000-8000-0000000000a1/stock-items"),
    ).toHaveLength(1);
    expect(sentTo("/inventory/stock-items/atp")[0]).toContain("warehouse=HN01");
  });

  it("reservation READ only: holds load and the directory is never read", async () => {
    open([reservationRead]);
    await lookUp("CUP-PP-500");
    await waitFor(() => expect(sentTo("/inventory/reservations")).toHaveLength(1));
    expect(sentTo("/warehouses")).toEqual([]);
  });

  it("losing warehouse READ mid-session stops the resolved warehouse driving new reads", async () => {
    const refocus = () =>
      act(() => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      });
    open([stockRead, reservationRead, warehouseRead]);
    await openHn01();
    await waitFor(() => expect(sentTo("/inventory/stock-items/atp")).toHaveLength(1));
    expect(await screen.findByRole("checkbox")).toBeInTheDocument();
    // Permissions refetch on focus; the next answer no longer carries warehouse READ.
    server.use(inventoryPermissions([stockRead, reservationRead]));
    refocus();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      `${INVENTORY_LABELS.directoryForbidden}: HN01`,
    );
    expect(screen.queryByRole("heading", { name: /Tồn theo vị trí và lô/ })).toBeNull();
    // Nor can the reservation filter narrow by that warehouse any more.
    expect(screen.queryByRole("checkbox")).toBeNull();
    // From here on the cached warehouse must drive no read, even on the next refocus.
    const items = sentTo("/inventory/warehouses").length;
    const atp = sentTo("/inventory/stock-items/atp").length;
    const directory = sentTo("/warehouses").length;
    refocus();
    await waitFor(() => expect(sentTo("/identity/me/permissions").length).toBeGreaterThan(2));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(sentTo("/inventory/warehouses")).toHaveLength(items);
    expect(sentTo("/inventory/stock-items/atp")).toHaveLength(atp);
    expect(sentTo("/warehouses")).toHaveLength(directory);
    act(() => focusManager.setFocused(undefined));
  });
});

describe("exact-SKU submission", () => {
  it("sends nothing while typing and nothing before a SKU is submitted", async () => {
    open([stockRead, reservationRead]);
    const user = userEvent.setup();
    expect(await screen.findByText(INVENTORY_LABELS.skuPrompt)).toBeInTheDocument();
    await user.type(screen.getByLabelText(INVENTORY_LABELS.skuLookup), "CUP-PP-5");
    expect(sent.filter((url) => url.startsWith("/inventory"))).toEqual([]);
  });

  it("submits on Enter, trimmed and upper-cased", async () => {
    open([stockRead]);
    await lookUp("  cup-pp-500  ");
    await waitFor(() =>
      expect(sentTo("/inventory/stock-levels")).toEqual(["/inventory/stock-levels?sku=CUP-PP-500"]),
    );
    expect(screen.getByText(`${INVENTORY_LABELS.activeSku}:`, { exact: false })).toHaveTextContent(
      "CUP-PP-500",
    );
  });

  it("submits with the button", async () => {
    open([stockRead]);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(INVENTORY_LABELS.skuLookup), "lid-pp-90");
    await user.click(screen.getByRole("button", { name: INVENTORY_LABELS.lookup }));
    await waitFor(() =>
      expect(sentTo("/inventory/stock-levels")).toEqual(["/inventory/stock-levels?sku=LID-PP-90"]),
    );
  });

  it("rejects a blank SKU inline and sends nothing", async () => {
    open([stockRead, reservationRead]);
    await lookUp("   ");
    expect(await screen.findByRole("alert")).toHaveTextContent(INVENTORY_MESSAGES.required);
    expect(screen.getByLabelText(INVENTORY_LABELS.skuLookup)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(sent.filter((url) => url.startsWith("/inventory"))).toEqual([]);
  });

  it("with both sections, a new SKU leaves no stale warehouse detail and no duplicate keys", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    open([stockRead, reservationRead, warehouseRead]);
    const user = await lookUp("CUP-PP-500");
    await user.click(
      await screen.findByRole("button", { name: `${INVENTORY_LABELS.viewWarehouse} HN01` }),
    );
    expect(await screen.findAllByRole("heading", { name: /Tồn theo vị trí và lô/ })).toHaveLength(
      1,
    );
    await lookUp("LID-PP-90");
    await waitFor(() =>
      expect(screen.queryAllByRole("heading", { name: /Tồn theo vị trí và lô/ })).toHaveLength(0),
    );
    expect(
      screen.getAllByRole("heading", { name: INVENTORY_LABELS.reservationsTitle }),
    ).toHaveLength(1);
    const keyWarnings = consoleError.mock.calls.filter((args) =>
      String(args[0]).includes("same key"),
    );
    consoleError.mockRestore();
    expect(keyWarnings).toEqual([]);
  });

  it("a new SKU drops the warehouse opened for the previous one", async () => {
    open([stockRead, warehouseRead]);
    const user = await lookUp("CUP-PP-500");
    await user.click(
      await screen.findByRole("button", { name: `${INVENTORY_LABELS.viewWarehouse} HN01` }),
    );
    expect(
      await screen.findByRole("heading", { name: /Tồn theo vị trí và lô/ }),
    ).toBeInTheDocument();
    await lookUp("LID-PP-90");
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /Tồn theo vị trí và lô/ })).toBeNull(),
    );
    expect(
      screen.getByRole("button", { name: `${INVENTORY_LABELS.viewWarehouse} HN01` }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
