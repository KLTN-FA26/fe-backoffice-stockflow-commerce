import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_ROUTES } from "@/constants/inventory";
import { NOTIFICATION_API } from "@/constants/notifications";

import { useAuthStore } from "@/lib/auth/auth-store";

import { toSafeNotificationPath } from "@/features/notification/link";

import { api } from "./client";
import { ApiError } from "./error";
import { activateMockAdapter } from "./mock-adapter";
import { resetNotificationMockStore, stockAlertSeverity } from "./mock-routes-notifications";

import type { AuthUser } from "@/lib/auth/auth-store";
import type { NotificationPage } from "@/features/notification/types";

activateMockAdapter();

// Demo accounts from mock-user-grants: two warehouse staff (inventory-alerts:READ) and an account
// with no grants standing in for a customer.
const staffA: AuthUser = {
  userId: "USER-WH-01",
  username: "a",
  email: "a@example.test",
  fullName: null,
  status: "ACTIVE",
  roles: ["INVENTORY_MANAGER"],
  lastLoginAt: null,
  mustChangePassword: false,
};
const staffB: AuthUser = {
  ...staffA,
  userId: "USER-WH-02",
  username: "b",
  email: "b@example.test",
};
const customer: AuthUser = { ...staffB, userId: "CUSTOMER-01", roles: ["CUSTOMER"] };
// Copied from the BE InventoryAlertMessages severity switch, not derived from the mock.
const BE_ALERT_SEVERITY: Record<string, string> = {
  SAFETY: "CRITICAL",
  EXPIRED: "CRITICAL",
  REORDER: "WARN",
  EXPIRING: "WARN",
};

function signIn(user: AuthUser) {
  useAuthStore.getState().login(user, false);
}
async function page(params: Record<string, string> = {}): Promise<NotificationPage> {
  return (await api.get<NotificationPage>(NOTIFICATION_API.inbox, { params })).data;
}

beforeEach(() => {
  resetNotificationMockStore();
  vi.spyOn(Math, "random").mockReturnValue(0.5); // disable the generic random 500
});

afterEach(() => {
  useAuthStore.getState().logout(false);
  vi.restoreAllMocks();
});

describe("mock inbox: ownership and BE endpoint semantics", () => {
  it("two signed-in staff can see only their own rows, even with recipientId override", async () => {
    signIn(staffA);
    const a = await page();
    expect(a.items.length).toBeGreaterThan(0);
    expect(a.unreadCount).toBe(a.items.length);

    signIn(staffB);
    const b = await page({ recipientId: staffA.userId });
    expect(b.items).toHaveLength(a.items.length);
    expect(b.items.every((item) => !a.items.some((other) => other.id === item.id))).toBe(true);

    await expect(api.post(NOTIFICATION_API.markRead(a.items[0]!.id))).rejects.toMatchObject({
      status: 404,
      code: "NOTIFICATION_NOT_FOUND",
    } satisfies Partial<ApiError>);
    const countB = (await api.get(NOTIFICATION_API.unreadCount)).data;
    expect(countB).toEqual({ unreadCount: b.items.length });

    signIn(staffA);
    expect((await page()).unreadCount).toBe(a.items.length);
  });

  it("stock-alert links follow BE InventoryAlertMessages (kind[, warehouseId]) and pass the safe-link policy", async () => {
    signIn(staffA);
    const links = (await page()).items.map((item) => item.link);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toMatch(
        /^\/admin\/inventory\/alerts\?kind=(REORDER|SAFETY|EXPIRING|EXPIRED)(&warehouseId=[\w-]+)?$/,
      );
      expect(link?.startsWith(`${INVENTORY_ROUTES.alerts}?`)).toBe(true);
      expect(link && toSafeNotificationPath(link)).toBe(link);
    }
  });

  // BE InventoryAlertMessages severity switch (develop 878a1be). The seeded SAFETY alert is
  // ACKNOWLEDGED, so it never reaches the inbox; the mapping is checked per kind instead.
  it.each(Object.entries(BE_ALERT_SEVERITY))(
    "a %s stock alert is %s, as BE sends it",
    (kind, severity) => {
      expect(stockAlertSeverity(kind)).toBe(severity);
    },
  );

  it("every seeded stock-alert notice carries the BE severity of its kind", async () => {
    signIn(staffA);
    const items = (await page()).items;
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const kind = new URLSearchParams(item.link?.split("?")[1]).get("kind") ?? "";
      expect(item.severity).toBe(BE_ALERT_SEVERITY[kind]);
    }
  });

  it("mark-one is idempotent, unreadOnly pages filter correctly, read-all stays per user", async () => {
    signIn(staffA);
    const a = await page({ page: "0", size: "1" });
    expect(a).toMatchObject({ page: 0, size: 1, hasNext: true });
    const id = a.items[0]!.id;
    expect((await api.post(NOTIFICATION_API.markRead(id))).status).toBe(204);
    expect((await api.post(NOTIFICATION_API.markRead(id))).status).toBe(204);
    const unread = await page({ unreadOnly: "true" });
    expect(unread.unreadCount).toBe(a.unreadCount - 1);
    expect(unread.items.every((item) => !item.read)).toBe(true);
    const firstAll = await api.post(NOTIFICATION_API.markAllRead);
    expect(firstAll.data).toEqual({ updated: a.unreadCount - 1 });
    expect((await api.post(NOTIFICATION_API.markAllRead)).data).toEqual({ updated: 0 });

    signIn(staffB);
    expect((await page()).unreadCount).toBe(a.unreadCount);
  });

  it("customer gets an empty own inbox, invalid parameters fail, signed-out cannot list", async () => {
    signIn(customer);
    expect(await page()).toMatchObject({ items: [], unreadCount: 0 });
    await expect(page({ size: "201" })).rejects.toMatchObject({
      status: 400,
      code: "UNSUPPORTED_PARAMETER",
    });
    useAuthStore.getState().logout(false);
    await expect(page()).rejects.toMatchObject({ status: 401 });
  });
});
