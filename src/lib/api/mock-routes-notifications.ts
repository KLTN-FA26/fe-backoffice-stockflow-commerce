/** In-memory inbox mock, scoped to the authenticated user like BE SCRUM-147. */
import { NOTIFICATION_API } from "@/constants/notifications";
import { ORDER_PERMISSIONS } from "@/constants/permissions";
import { ADMIN_ROUTES } from "@/constants/routes";

import { useAuthStore } from "@/lib/auth/auth-store";

import { registerMockRoute } from "./mock-adapter";
import { mockInstallments, outstandingOf, overdueOf } from "./mock-payment-store";
import { fail, noContent, ok, pageOf, pathParams, queryOf, typeMismatch } from "./mock-route-utils";
import { mockGrantsOf } from "./mock-user-grants";

import type { Notification } from "@/features/notification/types";
import type { MockInstallment } from "./mock-payment-store";
import type { MockResponseShape } from "./mock-route-utils";

const inboxes = new Map<string, Notification[]>();

/** Tests can start from the same seeded dataset without retaining mutations from older tests. */
export function resetNotificationMockStore() {
  inboxes.clear();
}

const ddMMyyyy = (iso: string) => iso.split("-").reverse().join("/");

/**
 * BE `InstallmentOverdueNotificationListener.message` (docs 15 §4.3 bước 11, 17 §4.9): category `PAYMENT_OVERDUE`,
 * WARN, câu tiếng Việt của `inbox.installment.overdue.*`, link tới chi tiết đơn, nguồn `INSTALLMENT`.
 */
export function installmentOverdueNotice(i: MockInstallment): Notification {
  const due = i.dueDate ?? "";
  const owed = `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(outstandingOf(i))} ${i.currency}`;
  return {
    id: crypto.randomUUID(),
    category: "PAYMENT_OVERDUE",
    severity: "WARN",
    title: `Khách có đợt thanh toán quá hạn: hợp đồng ${i.contractNumber}, đợt ${i.seq}`,
    body: `Đợt ${i.seq} của hợp đồng ${i.contractNumber} (đơn ${i.orderNumber}) có hạn trả ngày ${due ? ddMMyyyy(due) : "-"}, đã qua mà chưa trả đủ; còn phải thu ${owed}. Anh/chị có thể treo tay các đơn đang chạy của khách.`,
    link: ADMIN_ROUTES.orders.detail(i.orderId),
    sourceType: "INSTALLMENT",
    sourceId: i.installmentId,
    // BE quét hằng ngày: đợt quá hạn được báo vào đầu ngày sau hạn trả (giờ VN)
    createdAt: `${due}T17:00:00Z`,
    read: false,
  };
}

function inbox(): Notification[] | null {
  const user = useAuthStore.getState().user;
  if (!user || useAuthStore.getState().status !== "authenticated") return null;
  let entries = inboxes.get(user.userId);
  if (!entries) {
    // BE gửi thông báo đợt quá hạn cho người giữ `sales-order-holds:UPDATE` (theo quyền, không theo tên vai trò); mock
    // dựng từ đợt thanh toán seed đang quá hạn, không bịa số tiền. Tài khoản khác có hộp thư rỗng.
    entries = !mockGrantsOf(user.userId).has(ORDER_PERMISSIONS.hold)
      ? []
      : mockInstallments()
          .filter(overdueOf)
          .map(installmentOverdueNotice)
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
