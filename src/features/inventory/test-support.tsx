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
      mustChangePassword: false,
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
