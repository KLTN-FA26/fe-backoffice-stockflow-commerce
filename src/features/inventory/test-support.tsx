import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import { stockAdjustmentDto } from "./schemas";

import type { ReactNode } from "react";
import type { PermissionCode } from "@/lib/auth";
import type { RoleName } from "@/lib/auth/roles";
import type { StockAdjustment } from "./types";

// Generated test-only fixtures follow pinned StockAdjustmentResponse; they are
// never registered as demo records or imported by production components.
export function adjustmentFixture(overrides: Partial<StockAdjustment> = {}) {
  return stockAdjustmentDto.parse({
    adjustmentId: crypto.randomUUID(),
    number: "TEST-ADJUSTMENT",
    locationCode: "HCM-A01-1-A",
    sku: "CUP-PP-500",
    quantityDelta: -3,
    reason: "SCRAP",
    status: "PENDING_APPROVAL",
    requestedBy: crypto.randomUUID(),
    requestedAt: "2026-10-11T00:00:00Z",
    version: 0,
    ...overrides,
  });
}

// MSW URL of a production request: the shared client's same-origin base path
// (forwarded by the BFF proxy), resolved against the jsdom origin.
export function inventoryEndpoint(path: string) {
  return new URL(`${api.defaults.baseURL ?? ""}${path}`, window.location.origin).href;
}

// GET /identity/me/permissions for the current actor. Inventory capability comes
// only from these codes; the role names in the response are never consulted.
export function inventoryPermissions(
  permissions: readonly PermissionCode[],
  roles: readonly string[] = ["TEST"],
) {
  return http.get(inventoryEndpoint("/identity/me/permissions"), () =>
    HttpResponse.json({
      success: true,
      data: { roles: [...roles], permissions: [...permissions], dataScope: "ALL" },
    }),
  );
}

// Session user; the role is display metadata and does not grant Inventory access.
export function setInventoryTestActor(role: RoleName, userId = crypto.randomUUID()) {
  useAuthStore.setState({
    user: {
      userId,
      fullName: "Test actor",
      email: "actor@example.test",
      roles: [role],
      username: "actor",
      status: "ACTIVE",
      lastLoginAt: null,
    },
    status: "authenticated",
    isAuthenticated: true,
    impersonatedRole: null,
  });
  return userId;
}

export function renderInventory(ui: ReactNode, searchParams = "") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <NuqsTestingAdapter searchParams={searchParams} hasMemory>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </NuqsTestingAdapter>,
  );
}

// ── Inventory Overview (SCRUM-438) ───────────────────────────────────────────────────────────
// Test-only payloads in backend DTO shape (develop 0f18f24). Optional fields are omitted, as
// Jackson NON_NULL does.

export const OVERVIEW_WAREHOUSE = {
  id: "0e380000-0000-4000-8000-0000000000a1",
  prefix: "HN01",
  name: "Kho Hà Nội",
  status: "ACTIVE",
};

export const OVERVIEW_LEVELS = [
  {
    sku: "CUP-PP-500",
    warehouseCode: "HCM01",
    onHand: 90,
    available: 80,
    reserved: 80,
    allocated: 0,
    atp: 0,
  },
  {
    sku: "CUP-PP-500",
    warehouseCode: "HN01",
    onHand: 423,
    available: 350,
    reserved: 25,
    allocated: 0,
    atp: 330,
  },
];

export function overviewPage<T>(items: T[], meta: Partial<Record<string, unknown>> = {}) {
  return {
    items,
    page: 0,
    size: 15,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
    hasNext: false,
    hasPrevious: false,
    ...meta,
  };
}

export const OVERVIEW_STOCK_ITEMS = [
  {
    stockItemId: "0e380000-0000-4000-8000-000000000002",
    sku: "CUP-PP-500",
    locationCode: "HN01-A01-02-B",
    lotNumber: "L2602",
    expiryDate: "2027-03-01",
    onHand: 200,
    reserved: 0,
    available: 200,
    status: "AVAILABLE",
    receivedAt: "2026-09-10T02:00:00Z",
  },
  {
    stockItemId: "0e380000-0000-4000-8000-000000000005",
    sku: "CUP-PP-500",
    locationCode: "HN01-A02-01-A",
    onHand: 30,
    reserved: 0,
    available: 30,
    status: "AVAILABLE",
  },
];

export const OVERVIEW_RESERVATION = {
  reservationId: "0e380000-0000-4000-8000-000000000101",
  orderId: "0e380000-0000-4000-8000-000000000201",
  stockItemId: "0e380000-0000-4000-8000-000000000002",
  sku: "CUP-PP-500",
  locationCode: "HN01-A01-02-B",
  quantity: 20,
  status: "HELD",
  reservedAt: "2026-10-14T02:00:00Z",
};

export function overviewAlert(kind: string, extra: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    kind,
    sku: "CUP-PP-500",
    observedQty: 430,
    reservationImpaired: false,
    status: "OPEN",
    openedAt: "2026-10-15T01:00:00Z",
    lastObservedAt: "2026-10-16T01:00:00Z",
    version: 0,
    ...extra,
  };
}

/**
 * Backend + warehouse directory for the overview. Each override replaces one endpoint's answer;
 * alerts answer by kind (low stock vs expiry), as the two panels ask separately.
 */
export function overviewHandlers(
  overrides: {
    levels?: unknown;
    directory?: unknown;
    items?: unknown;
    atp?: unknown;
    reservations?: unknown;
    lowStock?: unknown;
    expiry?: unknown;
  } = {},
) {
  const ok = (data: unknown) => HttpResponse.json({ success: true, data });
  const answer = (value: unknown, fallback: unknown) =>
    value instanceof Response ? value : ok(value ?? fallback);
  return [
    http.get(inventoryEndpoint("/inventory/stock-levels"), () =>
      answer(overrides.levels, OVERVIEW_LEVELS),
    ),
    http.get(inventoryEndpoint("/warehouses"), () =>
      answer(overrides.directory, { items: [OVERVIEW_WAREHOUSE] }),
    ),
    http.get(inventoryEndpoint("/inventory/warehouses/:id/stock-items"), () =>
      answer(overrides.items, overviewPage(OVERVIEW_STOCK_ITEMS)),
    ),
    http.get(inventoryEndpoint("/inventory/stock-items/atp"), () => answer(overrides.atp, 330)),
    http.get(inventoryEndpoint("/inventory/reservations"), () =>
      answer(overrides.reservations, overviewPage([OVERVIEW_RESERVATION])),
    ),
    http.get(inventoryEndpoint("/inventory/alerts"), ({ request }) => {
      const kind = new URL(request.url).searchParams.get("kind") ?? "";
      return kind.includes("REORDER")
        ? answer(overrides.lowStock, overviewPage([]))
        : answer(overrides.expiry, overviewPage([]));
    }),
  ];
}
