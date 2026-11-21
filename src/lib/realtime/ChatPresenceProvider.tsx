"use client";

import { useEffect } from "react";

import { CHAT_PERMISSIONS } from "@/constants";

import { useAuthStore } from "@/lib/auth/auth-store";
import { useCan } from "@/lib/auth/components/Can";

import { PresenceConnection } from "./presence-connection";

import type { ReactNode } from "react";

/**
 * Holds the staff presence socket open while a signed-in user with chat access is in the back office (BE-12). Keyed on
 * the user: a sign-out or a different user closes the socket, and a new one opens with that user's own ticket.
 * No `NEXT_PUBLIC_WS_URL` → nothing at all.
 */
export function ChatPresenceProvider({ children }: { children: ReactNode }) {
  const canChat = useCan(CHAT_PERMISSIONS.read);
  const userId = useAuthStore((state) => state.user?.userId ?? null);
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_WS_URL;
    if (!canChat || !userId || !url) return;
    const connection = new PresenceConnection({ url });
    connection.start();
    return () => connection.stop();
  }, [canChat, userId]);
  return <>{children}</>;
}
