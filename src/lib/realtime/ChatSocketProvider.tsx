"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

import { CHAT_PERMISSIONS } from "@/constants";

import { useAuthStore } from "@/lib/auth/auth-store";
import { useCan } from "@/lib/auth/components/Can";
import { useIsMock } from "@/providers/app-providers";

import { ChatConnection } from "./chat-connection";

import type { ReactNode } from "react";
import type { SocketListener } from "./chat-connection";

const ChatSocketContext = createContext<ChatConnection | null>(null);

/**
 * Holds the back office's one chat socket (presence + chat events, `ChatConnection`) open while a signed-in user with
 * chat access is in the back office (BE-12, FE fix list A.3). Keyed on the user: a sign-out or a different user closes
 * the socket, and a new one opens with that user's own ticket. No `NEXT_PUBLIC_WS_URL` (inlined at build), or mock
 * mode (the mock adapter has no ticket endpoint) → no socket: screens see "not connected" and keep polling.
 */
export function ChatSocketProvider({ children }: { children: ReactNode }) {
  const canChat = useCan(CHAT_PERMISSIONS.read);
  const userId = useAuthStore((state) => state.user?.userId ?? null);
  const isMock = useIsMock();
  const url = process.env.NEXT_PUBLIC_WS_URL;
  // One per user; constructing opens nothing - the effect starts it and stops it on change or unmount.
  const connection = useMemo(
    () => (isMock || !canChat || !userId || !url ? null : new ChatConnection({ url })),
    [isMock, canChat, userId, url],
  );
  useEffect(() => {
    if (!connection) return;
    connection.start();
    return () => connection.stop();
  }, [connection]);
  return <ChatSocketContext.Provider value={connection}>{children}</ChatSocketContext.Provider>;
}

/** Whether chat events are arriving now; false without a socket (polling then stays the way to see changes). */
export function useChatSocketStatus(): boolean {
  const connection = useContext(ChatSocketContext);
  const subscribe = useCallback(
    (notify: () => void) => connection?.onStatus(notify) ?? (() => undefined),
    [connection],
  );
  return useSyncExternalStore(
    subscribe,
    () => connection?.isConnected() ?? false,
    () => false,
  );
}

/**
 * Listens to one chat destination while mounted (`null` = not now). The latest `listener` is called; changing it does
 * not resubscribe. Without a socket nothing happens.
 */
export function useChatSubscription(destination: string | null, listener: SocketListener): void {
  const connection = useContext(ChatSocketContext);
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => {
    if (!connection || !destination) return;
    return connection.subscribe(destination, (event) => latest.current(event));
  }, [connection, destination]);
}
