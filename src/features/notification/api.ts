import { NOTIFICATION_API } from "@/constants/notifications";

import { api } from "@/lib/api/client";

import {
  notificationListParams,
  notificationMarkAllDto,
  notificationPageDto,
  notificationUnreadCountDto,
} from "./schemas";

import type { NotificationListParams, NotificationPage } from "./types";

export async function listMyNotifications(
  params: NotificationListParams,
  signal?: AbortSignal,
): Promise<NotificationPage> {
  const { data } = await api.get<unknown>(NOTIFICATION_API.inbox, {
    params: notificationListParams.parse(params),
    signal,
  });
  return notificationPageDto.parse(data);
}

export async function getMyUnreadCount(signal?: AbortSignal): Promise<number> {
  const { data } = await api.get<unknown>(NOTIFICATION_API.unreadCount, { signal });
  return notificationUnreadCountDto.parse(data).unreadCount;
}

export async function markMyNotificationRead(id: string): Promise<void> {
  await api.post(NOTIFICATION_API.markRead(id)); // 204; idempotent, BE verifies ownership.
}

export async function markAllMyNotificationsRead(): Promise<number> {
  const { data } = await api.post<unknown>(NOTIFICATION_API.markAllRead);
  return notificationMarkAllDto.parse(data).updated;
}
