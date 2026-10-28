/** In-memory inbox mock, scoped to the authenticated user like BE SCRUM-147. */
import { NOTIFICATION_API } from "@/constants/notifications";

import { useAuthStore } from "@/lib/auth/auth-store";

import { registerMockRoute } from "./mock-adapter";
import { MOCK_STOCK_ALERTS } from "./mock-routes-inventory-stock-data";
import { fail, noContent, ok, pageOf, pathParams, queryOf, typeMismatch } from "./mock-route-utils";

import type { Notification } from "@/features/notification/types";
import type { MockResponseShape } from "./mock-route-utils";

const inboxes = new Map<string, Notification[]>();

/** Tests can start from the same seeded dataset without retaining mutations from older tests. */
export function resetNotificationMockStore() {
  inboxes.clear();
}

function inbox(): Notification[] | null {
  const user = useAuthStore.getState().user;
  if (!user || useAuthStore.getState().status !== "authenticated") return null;
  let entries = inboxes.get(user.userId);
  if (!entries) {
    // Mock staff messages are based on existing inventory alert fixtures, not invented stock levels.
    // Customers have an accessible but empty inbox; stock-alert links are staff-only.
    entries = user.roles.includes("CUSTOMER")
      ? []
      : MOCK_STOCK_ALERTS.filter((alert) => alert.status === "OPEN")
          .map((alert) => ({
            id: crypto.randomUUID(),
            category: "INVENTORY_ALERT",
            severity: alert.kind === "EXPIRED" ? ("CRITICAL" as const) : ("WARN" as const),
            title: `${alert.kind} · ${alert.sku}`,
            body: `${alert.observedQty} sản phẩm cần kiểm tra`,
            link: `/admin/inventory/alerts?sku=${encodeURIComponent(alert.sku)}`,
            sourceType: "STOCK_ALERT",
            sourceId: alert.id,
            createdAt: alert.openedAt,
            read: false,
          }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    inboxes.set(user.userId, entries);
  }
  return entries;
}

function ownInbox(): Notification[] | MockResponseShape {
  return inbox() ?? fail(401, "UNAUTHORIZED", "Authentication required");
}

function isError(value: Notification[] | MockResponseShape): value is MockResponseShape {
  return !Array.isArray(value);
}

export function registerNotificationMockRoutes() {
  registerMockRoute("GET", NOTIFICATION_API.inbox, (config) => {
    const entries = ownInbox();
    if (isError(entries)) return entries;
    const query = queryOf(config);
    const pageText = query.get("page") ?? "0";
    const sizeText = query.get("size") ?? "20";
    const unreadText = query.get("unreadOnly") ?? "false";
    const page = Number(pageText);
    const size = Number(sizeText);
    if (!/^\d+$/.test(pageText) || !Number.isSafeInteger(page))
      return typeMismatch("page", "non-negative integer");
    if (!/^\d+$/.test(sizeText) || !Number.isSafeInteger(size) || size < 1 || size > 200)
      return typeMismatch("size", "integer in [1,200]");
    if (unreadText !== "true" && unreadText !== "false")
      return typeMismatch("unreadOnly", "boolean");
    const filtered = unreadText === "true" ? entries.filter((item) => !item.read) : entries;
    return ok({
      ...pageOf(filtered, page, size),
      unreadCount: entries.filter((item) => !item.read).length,
    });
  });

  registerMockRoute("GET", NOTIFICATION_API.unreadCount, () => {
    const entries = ownInbox();
    return isError(entries)
      ? entries
      : ok({ unreadCount: entries.filter((item) => !item.read).length });
  });

  registerMockRoute("POST", NOTIFICATION_API.markAllRead, () => {
    const entries = ownInbox();
    if (isError(entries)) return entries;
    const updated = entries.filter((item) => !item.read).length;
    for (const item of entries) {
      if (!item.read) {
        item.read = true;
        item.readAt = new Date().toISOString();
      }
    }
    return ok({ updated });
  });

  registerMockRoute("POST", "/notifications/me/:id/read", (config) => {
    const entries = ownInbox();
    if (isError(entries)) return entries;
    const item = entries.find((entry) => entry.id === pathParams(config).id);
    // Another user's id and a nonexistent id are indistinguishable.
    if (!item) return fail(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
    if (!item.read) {
      item.read = true;
      item.readAt = new Date().toISOString();
    }
    return noContent();
  });
}
