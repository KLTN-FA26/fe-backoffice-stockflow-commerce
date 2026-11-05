import { cleanup, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_API, INVENTORY_ROUTES } from "@/constants/inventory";
import { MOVE_LABELS } from "@/constants/move";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";

import {
  inventoryEndpoint,
  inventoryPermissions,
  renderInventory,
  setInventoryTestActor,
} from "../test-support";
import { RecentMoves } from "./RecentMoves";

const server = setupServer();
const endpoint = inventoryEndpoint(INVENTORY_API.movements);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => setInventoryTestActor("Warehouse Staff"));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe("RecentMoves", () => {
  it("asks the ledger for MOVE lines only, newest first (BE order), and links to the full history", async () => {
    const asked = vi.fn();
    server.use(
      inventoryPermissions([INVENTORY_PERMISSIONS.movementRead]),
      http.get(endpoint, ({ request }) => {
        asked(Object.fromEntries(new URL(request.url).searchParams));
        return HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                movementId: crypto.randomUUID(),
                type: "MOVE",
                sku: "CUP-PP-500",
                fromLocation: "HCM-A01-1-A",
                toLocation: "HCM-PACK01",
                quantity: 5,
                referenceType: "MOVE_TASK",
                occurredAt: "2026-10-19T03:00:00Z",
              },
            ],
            page: 0,
            size: 10,
            totalElements: 1,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false,
          },
        });
      }),
    );
    renderInventory(<RecentMoves />);
    expect(await screen.findByText("HCM-PACK01")).toBeInTheDocument();
    expect(asked).toHaveBeenCalledWith({ page: "0", size: "10", type: "MOVE" });
    expect(screen.getByRole("link", { name: MOVE_LABELS.recentAll })).toHaveAttribute(
      "href",
      INVENTORY_ROUTES.movements,
    );
  });

  it("says so when there is no move yet", async () => {
    server.use(
      inventoryPermissions([INVENTORY_PERMISSIONS.movementRead]),
      http.get(endpoint, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [],
            page: 0,
            size: 10,
            totalElements: 0,
            totalPages: 0,
            hasNext: false,
            hasPrevious: false,
          },
        }),
      ),
    );
    renderInventory(<RecentMoves />);
    expect(await screen.findByText(MOVE_LABELS.recentEmpty)).toBeInTheDocument();
  });

  it("without inventory-stock-movements:READ it only explains, and never calls the ledger", async () => {
    server.use(inventoryPermissions([INVENTORY_PERMISSIONS.stockUpdate]));
    renderInventory(<RecentMoves />);
    await waitFor(() =>
      expect(screen.getByText(MOVE_LABELS.recentUnavailable)).toBeInTheDocument(),
    );
    // Give a stray request time to surface (onUnhandledRequest: "error" would fail the test).
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
});
