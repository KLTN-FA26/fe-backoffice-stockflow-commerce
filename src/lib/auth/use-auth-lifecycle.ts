"use client";

import { useEffect } from "react";

import { subscribeAuthEvents } from "./auth-events";
import { bootstrapSession, revalidateSession } from "./auth-session";
import { discardLegacyAuthState, useAuthStore } from "./auth-store";

/** Every fresh browser session is verified by the BFF, never by a cached identity. */
export function useAuthLifecycle() {
  const status = useAuthStore((state) => state.status);
  const isAuthenticated = useAuthStore(
    (state) => state.status === "authenticated" && state.user !== null,
  );
  const bootstrapError = useAuthStore((state) => state.bootstrapError);
  useEffect(() => {
    discardLegacyAuthState();
    // Another tab logged in or out: always ask the BFF, even from a signed-out tab.
    const onSessionEvent = () => {
      void revalidateSession("session-event");
    };
    // Focus checks a shown session in the background; a signed-out tab does not poll /me.
    const onFocus = () => {
      const { status } = useAuthStore.getState();
      if (status === "authenticated") void revalidateSession("focus");
      else if (status === "unknown") void bootstrapSession();
    };
    const unsubscribe = subscribeAuthEvents(onSessionEvent);
    window.addEventListener("focus", onFocus);
    if (useAuthStore.getState().status === "unknown") void bootstrapSession();
    return () => {
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  return {
    status,
    isAuthenticated,
    bootstrapError,
    retry: () => {
      void bootstrapSession();
    },
  };
}
