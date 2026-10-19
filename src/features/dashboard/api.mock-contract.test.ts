/**
 * Contract test: every dashboard source answers on the mock with the BE shape the real client
 * parses — the counters read `totalElements` of a size-1 page, the alerts follow StockAlertController.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { DASHBOARD_API } from "@/constants/dashboard";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { useAuthStore } from "@/lib/auth/auth-store";

import { fetchAlertSummary, fetchCount, listOpenAlerts } from "./api";
import { KPI_DEFINITIONS } from "./kpis";

vi.setConfig({ testTimeout: 30_000 });

const originalAdapter = api.defaults.adapter;

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
  useAuthStore.setState({
    user: {
      userId: "USER-ADMIN-01",
      username: "admin",
      fullName: "Admin",
      email: "admin@example.test",
      roles: ["Warehouse Manager"],
      status: "ACTIVE",
      lastLoginAt: null,
    },
    status: "authenticated",
    isAuthenticated: true,
    impersonatedRole: null,
  });
});
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("dashboard sources on the mock", () => {
  it.each(KPI_DEFINITIONS.map((definition) => [definition.key, definition] as const))(
    "%s counts through its list endpoint",
    async (_key, definition) => {
      const count = await fetchCount(definition.source);
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(0);
    },
  );

  it("counting statuses one by one equals the sum of the single-status counts", async () => {
    const source = {
      path: DASHBOARD_API.pickTasks,
      statuses: ["PENDING", "PICKING"],
      repeatStatus: false,
    };
    const [pending, picking] = await Promise.all([
      fetchCount({ ...source, statuses: ["PENDING"] }),
      fetchCount({ ...source, statuses: ["PICKING"] }),
    ]);
    expect(await fetchCount(source)).toBe(pending + picking);
  });

  it("the BE rejects an unknown pick status (400 UNSUPPORTED_PARAMETER)", async () => {
    await expect(
      fetchCount({ path: DASHBOARD_API.pickTasks, statuses: ["NOPE"], repeatStatus: false }),
    ).rejects.toMatchObject({ status: 400, code: "UNSUPPORTED_PARAMETER" });
    await expect(
      fetchCount({ path: DASHBOARD_API.pickTasks, statuses: ["NOPE"], repeatStatus: false }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("a status filter narrows the count (PO list)", async () => {
    const all = await fetchCount({
      path: DASHBOARD_API.purchaseOrders,
      statuses: [],
      repeatStatus: true,
    });
    const pending = await fetchCount({
      path: DASHBOARD_API.purchaseOrders,
      statuses: ["PENDING_APPROVAL"],
      repeatStatus: true,
    });
    expect(pending).toBeLessThanOrEqual(all);
  });

  it("stock alerts: summary names every kind with zero, the list is empty (the mock holds no stock)", async () => {
    expect(await fetchAlertSummary()).toEqual({
      openByKind: { REORDER: 0, SAFETY: 0, EXPIRING: 0, EXPIRED: 0 },
    });
    expect(await listOpenAlerts()).toMatchObject({ items: [], totalElements: 0 });
  });
});
