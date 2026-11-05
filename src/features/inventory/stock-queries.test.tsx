import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { INVENTORY_API, INVENTORY_QUERY_KEYS } from "@/constants/inventory";

import {
  stockAlertKeys,
  stockKeys,
  stockReservationKeys,
  useAtp,
  useReservations,
  useStockAlerts,
  useStockLevels,
  useWarehouseStockItems,
} from "./queries";
import { inventoryEndpoint } from "./test-support";

import type { ReactNode } from "react";

const server = setupServer();
const requests: URL[] = [];
const emptyPage = {
  items: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
};

function serve(path: string, data: unknown) {
  server.use(
    http.get(inventoryEndpoint(path), ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json({ success: true, data });
    }),
  );
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  requests.length = 0;
});
afterAll(() => server.close());

describe("overview query keys", () => {
  it("nest stock reads under the shared stock root that adjustment approval invalidates", () => {
    expect(stockKeys.levels("CUP-PP-500", null)[0]).toBe(INVENTORY_QUERY_KEYS.stock);
    expect(stockKeys.atp("CUP-PP-500", "HN01", null)).toEqual([
      INVENTORY_QUERY_KEYS.stock,
      "atp",
      null,
      "CUP-PP-500",
      "HN01",
    ]);
    expect(stockReservationKeys.list(null, null)[0]).toBe("inventory-reservations");
    expect(stockAlertKeys.list(null, null)[0]).toBe("inventory-alerts");
  });
});

describe("useStockLevels", () => {
  it("does not request without a SKU", () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useStockLevels("  "), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(requests).toHaveLength(0);
  });

  it("keys on the normalised SKU, so equivalent input shares one cache entry", async () => {
    serve(INVENTORY_API.stockLevels, []);
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useStockLevels(" cup-pp-500 "), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(stockKeys.levels("CUP-PP-500", null))).toEqual([]);
  });
});

describe("useWarehouseStockItems", () => {
  it("does not request until a warehouse is chosen", () => {
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useWarehouseStockItems({ warehouseId: "", sku: "CUP-PP-500", page: 0, size: 20 }),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(requests).toHaveLength(0);
  });

  it("keys on every data-affecting parameter", async () => {
    serve(INVENTORY_API.warehouseStockItems("WH-HN-01"), emptyPage);
    const { client, wrapper } = setup();
    const params = {
      warehouseId: "WH-HN-01",
      sku: "cup-pp-500",
      status: ["AVAILABLE" as const],
      page: 1,
      size: 20,
      sort: { field: "expiryDate" as const, direction: "asc" as const },
    };
    const { result } = renderHook(() => useWarehouseStockItems(params), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [key] = client.getQueryCache().findAll({ queryKey: [INVENTORY_QUERY_KEYS.stock] });
    expect(key?.queryKey).toEqual([
      INVENTORY_QUERY_KEYS.stock,
      "warehouse-items",
      null,
      "WH-HN-01",
      {
        warehouseId: "WH-HN-01",
        sku: "CUP-PP-500",
        location: undefined,
        lot: undefined,
        status: "AVAILABLE",
        page: 1,
        size: 20,
        sort: "expiryDate,asc",
      },
    ]);
  });
});

describe("useAtp", () => {
  it("never asks for unscoped, system-wide ATP", () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useAtp({ sku: "CUP-PP-500", warehouse: " " }), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(requests).toHaveLength(0);
  });

  it("asks for one warehouse and keeps zero as data", async () => {
    serve(INVENTORY_API.atp, 0);
    const { wrapper } = setup();
    const { result } = renderHook(() => useAtp({ sku: "cup-pp-500", warehouse: "HCM01" }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(0);
    expect(requests[0]?.searchParams.get("warehouse")).toBe("HCM01");
  });
});

describe("paged lists", () => {
  it("load reservations and alerts with their filters", async () => {
    serve(INVENTORY_API.reservations, emptyPage);
    serve(INVENTORY_API.alerts, emptyPage);
    const { wrapper } = setup();
    const reservations = renderHook(
      () => useReservations({ sku: "CUP-PP-500", warehouse: "HN01", page: 0, size: 20 }),
      { wrapper },
    );
    const alerts = renderHook(
      () => useStockAlerts({ kind: ["REORDER", "SAFETY"], sku: "CUP-PP-500", page: 0, size: 20 }),
      { wrapper },
    );
    await waitFor(() => expect(reservations.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(alerts.result.current.isSuccess).toBe(true));
    expect(requests.map((url) => url.pathname).sort()).toEqual([
      `/api/backend${INVENTORY_API.alerts}`,
      `/api/backend${INVENTORY_API.reservations}`,
    ]);
  });
});

describe("warehouse cache isolation", () => {
  it("does not reuse a previous warehouse's stock rows while the next read is pending", async () => {
    serve(INVENTORY_API.warehouseStockItems("WH-HN-01"), emptyPage);
    server.use(
      http.get(
        inventoryEndpoint(INVENTORY_API.warehouseStockItems("WH-HCM-01")),
        async ({ request }) => {
          requests.push(new URL(request.url));
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({ success: true, data: emptyPage });
        },
      ),
    );
    const { wrapper } = setup();
    const { result, rerender } = renderHook(
      ({ warehouseId }) => useWarehouseStockItems({ warehouseId, sku: "A", page: 0, size: 20 }),
      { wrapper, initialProps: { warehouseId: "WH-HN-01" } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ warehouseId: "WH-HCM-01" });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPlaceholderData).toBe(false);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it.each(["-A", "_A", ".A", "A B", "A".repeat(65)])(
    "invalid SKU %s never requests stock",
    (sku) => {
      const { wrapper } = setup();
      const { result } = renderHook(() => useStockLevels(sku), { wrapper });
      expect(result.current.fetchStatus).toBe("idle");
      expect(requests).toHaveLength(0);
    },
  );
});
