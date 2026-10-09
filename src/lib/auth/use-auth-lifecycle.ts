"use client";

import { useEffect, useSyncExternalStore } from "react";

import { AUTH_STORAGE_KEY } from "@/constants/auth";

import { useAuthStore } from "./auth-store";

function subscribeHydration(notify: () => void) {
  const unsubscribeStart = useAuthStore.persist.onHydrate(notify);
  const unsubscribeFinish = useAuthStore.persist.onFinishHydration(notify);
  return () => {
    unsubscribeStart();
    unsubscribeFinish();
  };
}

/** Shared by admin and login. Persist owns parsing; cookie never supplies identity. */
export function useAuthLifecycle() {
  const hasHydrated = useSyncExternalStore(
    subscribeHydration,
    useAuthStore.persist.hasHydrated,
    () => false,
  );
  const isAuthenticated = useAuthStore(
    (state) => state.isAuthenticated && state.user !== null && Boolean(state.tokens?.accessToken),
  );

  useEffect(() => {
    const reconcile = () => {
      void useAuthStore.persist.rehydrate();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_STORAGE_KEY && event.key !== null) return;
      if (event.storageArea !== null && event.storageArea !== localStorage) return;
      reconcile();
    };
    const onFocus = () => {
      const state = useAuthStore.getState();
      // A live /me bootstrap has temporary tokens but deliberately no persisted session yet.
      if (state.tokens && !state.isAuthenticated) return;
      reconcile();
    };
    window.addEventListener("storage", onStorage);
    // Reconcile changes made while this tab was inactive, including manual storage/cookie edits.
    window.addEventListener("focus", onFocus);
    if (!useAuthStore.persist.hasHydrated()) reconcile();
    else useAuthStore.getState().synchronizeCookie();
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return { hasHydrated, isAuthenticated };
}
