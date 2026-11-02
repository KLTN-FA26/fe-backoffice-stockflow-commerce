import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/lib/auth/auth-store";

import { markAllMyNotificationsRead, markMyNotificationRead } from "./api";
import { notificationKeys } from "./queries";

function useSessionInvalidation() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.userId ?? null);
  const version = useAuthStore((state) => state.authorizationVersion);
  return () =>
    queryClient.invalidateQueries({ queryKey: notificationKeys.session(userId, version) });
}

// Settled, not only success: a 404 NOTIFICATION_NOT_FOUND (purged, or never this user's) or any other
// failure must refetch the inbox and badge so the stale row does not linger.
export function useMarkNotificationRead() {
  const invalidate = useSessionInvalidation();
  return useMutation({ mutationFn: markMyNotificationRead, onSettled: invalidate });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useSessionInvalidation();
  return useMutation({ mutationFn: markAllMyNotificationsRead, onSettled: invalidate });
}
