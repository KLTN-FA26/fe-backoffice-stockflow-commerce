import { useQuery, useQueryClient } from "@tanstack/react-query";

import { NOTIFICATION_CONFIG } from "@/constants/notifications";

import { useAuthStore } from "@/lib/auth/auth-store";

import { getMyUnreadCount, listMyNotifications } from "./api";

import type { NotificationListParams } from "./types";

export const notificationKeys = {
  all: ["notifications", "me"] as const,
  session: (userId: string | null, version: number) =>
    [...notificationKeys.all, userId, version] as const,
  list: (userId: string | null, version: number, params: NotificationListParams) =>
    [...notificationKeys.session(userId, version), "list", params] as const,
  count: (userId: string | null, version: number) =>
    [...notificationKeys.session(userId, version), "unread-count"] as const,
};

/** All inbox cache entries are session-scoped: never reuse A's messages for B. */
export function useNotificationInbox(params: NotificationListParams) {
  const userId = useAuthStore((state) => state.user?.userId ?? null);
  const version = useAuthStore((state) => state.authorizationVersion);
  const authenticated = useAuthStore((state) => state.status === "authenticated");
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: notificationKeys.list(userId, version, params),
    queryFn: async ({ signal }) => {
      const page = await listMyNotifications(params, signal);
      // List includes unreadCount. Seed polling without a redundant initial count GET.
      queryClient.setQueryData(notificationKeys.count(userId, version), page.unreadCount);
      return page;
    },
    enabled: authenticated && userId !== null,
    gcTime: 0,
    refetchOnWindowFocus: "always",
  });
}

/** Starts count-only polling after the first inbox page has seeded the count. */
export function useNotificationUnreadCount(inboxReady: boolean) {
  const userId = useAuthStore((state) => state.user?.userId ?? null);
  const version = useAuthStore((state) => state.authorizationVersion);
  const authenticated = useAuthStore((state) => state.status === "authenticated");
  return useQuery({
    queryKey: notificationKeys.count(userId, version),
    queryFn: ({ signal }) => getMyUnreadCount(signal),
    enabled: authenticated && userId !== null && inboxReady,
    staleTime: NOTIFICATION_CONFIG.pollingMs,
    refetchInterval: NOTIFICATION_CONFIG.pollingMs,
    gcTime: 0,
  });
}
