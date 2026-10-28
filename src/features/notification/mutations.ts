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

export function useMarkNotificationRead() {
  const invalidate = useSessionInvalidation();
  return useMutation({ mutationFn: markMyNotificationRead, onSuccess: invalidate });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useSessionInvalidation();
  return useMutation({ mutationFn: markAllMyNotificationsRead, onSuccess: invalidate });
}
