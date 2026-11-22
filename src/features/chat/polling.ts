"use client";

/**
 * Chat polling vs the socket (FE fix list A.3). While the one chat socket is up, events update the screens and
 * polling is only a safety net (the BE pushes best effort); while it is down — or there is none, without
 * `NEXT_PUBLIC_WS_URL` or in mock mode — polling is how changes arrive, every 5 s as before. Never in a hidden tab.
 */

import { CHAT_LIVE_POLL_MS, CHAT_POLL_MS } from "@/constants";

import { useChatSocketStatus } from "@/lib/realtime";

/** The poll period: the slow safety net while events arrive, else `fallback`. */
export function chatPollInterval(live: boolean, fallback: number = CHAT_POLL_MS): number {
  return live ? Math.max(CHAT_LIVE_POLL_MS, fallback) : fallback;
}

/** React Query options for a chat poll, following the socket's state. */
export function usePolling(fallback: number = CHAT_POLL_MS) {
  const live = useChatSocketStatus();
  return {
    refetchInterval: chatPollInterval(live, fallback),
    refetchIntervalInBackground: false,
  } as const;
}
