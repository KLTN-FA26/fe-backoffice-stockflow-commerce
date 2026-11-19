import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES } from "@/constants/routes";
import { NOTIFICATION_API } from "@/constants/notifications";

import { useAuthStore } from "@/lib/auth/auth-store";

import { toSafeNotificationPath } from "@/features/notification/link";

import { api } from "./client";
import { ApiError } from "./error";
import { activateMockAdapter } from "./mock-adapter";
import { mockInstallments, overdueOf, resetPaymentMockStore } from "./mock-payment-store";
import { resetNotificationMockStore } from "./mock-routes-notifications";

import type { AuthUser } from "@/lib/auth/auth-store";
import type { NotificationPage } from "@/features/notification/types";

activateMockAdapter();

// Demo accounts from mock-user-grants: two salespeople (sales-order-holds:UPDATE — who BE
// InstallmentOverdueNotificationListener tells), a warehouse staff without it, and an account with
// no grants standing in for a customer.
const staffA: AuthUser = {
  userId: "USER-SALE-01",
  username: "a",
  email: "a@example.test",
  fullName: null,
  status: "ACTIVE",
  roles: ["SALES_STAFF"],
  lastLoginAt: null,
  mustChangePassword: false,
};
const staffB: AuthUser = {
  ...staffA,
  userId: "USER-SALE-02",
  username: "b",
  email: "b@example.test",
};
const warehouse: AuthUser = { ...staffB, userId: "USER-WH-01", roles: ["WAREHOUSE_STAFF"] };
const customer: AuthUser = { ...staffB, userId: "CUSTOMER-01", roles: ["CUSTOMER"] };

function signIn(user: AuthUser) {
  useAuthStore.getState().login(user, false);
}
async function page(params: Record<string, string> = {}): Promise<NotificationPage> {
  return (await api.get<NotificationPage>(NOTIFICATION_API.inbox, { params })).data;
}

beforeEach(() => {
  // "Overdue" is computed from today (mockToday): pin it so the seed gives a fixed set of overdue installments.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T05:00:00Z"));
  resetPaymentMockStore();
  resetNotificationMockStore();
  vi.spyOn(Math, "random").mockReturnValue(0.5); // disable the generic random 500
});

afterEach(() => {
  useAuthStore.getState().logout(false);
  vi.useRealTimers();
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

  it("seeds one PAYMENT_OVERDUE notice per overdue installment, worded and linked as BE sends it", async () => {
    signIn(staffA);
    const items = (await page()).items;
    const overdue = mockInstallments().filter(overdueOf);
    expect(overdue.length).toBeGreaterThan(1);
    expect(items.map((item) => item.sourceId).sort()).toEqual(
      overdue.map((i) => i.installmentId).sort(),
    );
    for (const item of items) {
      const installment = overdue.find((i) => i.installmentId === item.sourceId);
      expect(item).toMatchObject({
        category: "PAYMENT_OVERDUE",
        severity: "WARN",
        sourceType: "INSTALLMENT",
        link: ADMIN_ROUTES.orders.detail(installment?.orderId ?? ""),
        title: `Khách có đợt thanh toán quá hạn: hợp đồng ${installment?.contractNumber}, đợt ${installment?.seq}`,
      });
      expect(item.body).toContain(`(đơn ${installment?.orderNumber})`);
      expect(item.link && toSafeNotificationPath(item.link)).toBe(item.link);
    }
    // Mới nhất trước
    const created = items.map((item) => item.createdAt);
    expect(created).toEqual([...created].sort().reverse());
  });

  it("only holders of sales-order-holds:UPDATE are told; warehouse staff get an empty inbox", async () => {
    signIn(warehouse);
    expect(await page()).toMatchObject({ items: [], unreadCount: 0 });
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
