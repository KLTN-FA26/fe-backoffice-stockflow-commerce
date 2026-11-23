import { cleanup, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CYCLE_COUNT_API } from "@/constants/cycle-count";
import { CYCLE_COUNT_PERMISSIONS } from "@/constants/permissions";

import {
  cycleCountFixture,
  INVENTORY_TAB_WAREHOUSE,
  inventoryEndpoint,
  inventoryPermissions,
  renderInventory,
  setInventoryTestActor,
} from "../test-support";
import { CycleCountRedirect } from "./CycleCountRedirect";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => setInventoryTestActor("Warehouse Staff"));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  replace.mockReset();
});
afterAll(() => server.close());

describe("link cũ /admin/inventory/cycle-counts/{id} → phiếu trong tab theo kho (spec §5.5)", () => {
  it("chuyển sang kho của phiếu", async () => {
    const count = cycleCountFixture({ warehouseId: INVENTORY_TAB_WAREHOUSE.id });
    server.use(
      inventoryPermissions([CYCLE_COUNT_PERMISSIONS.viewPage, CYCLE_COUNT_PERMISSIONS.read]),
      http.get(inventoryEndpoint(CYCLE_COUNT_API.detail(count.id)), () =>
        HttpResponse.json({ success: true, data: count }),
      ),
      http.get(inventoryEndpoint("/warehouses"), () =>
        HttpResponse.json({
          success: true,
          data: { items: [{ id: INVENTORY_TAB_WAREHOUSE.id, prefix: "HCM", name: "Kho HCM" }] },
        }),
      ),
    );
    renderInventory(<CycleCountRedirect id={count.id} />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`/admin/warehouse-map/HCM/cycle-counts/${count.id}`),
    );
  });
});
