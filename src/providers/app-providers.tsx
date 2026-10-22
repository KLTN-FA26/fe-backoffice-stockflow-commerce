/**
 * App providers — wraps all client-side context providers.
 *
 * Composed in root layout so every page has access to:
 *  - TanStack Query (server state)
 *  - nuqs (URL search params)
 *  - Toast
 *  - Auth session (added in Phase 0b)
 *  - Mock mode flag (read server-side from USE_MOCK, threaded via context —
 *    see `useIsMock`)
 */

"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { makeQueryClient } from "@/lib/api/query-client";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { useAuthStore } from "@/lib/auth/auth-store";

const MockModeContext = createContext(false);

/** Whether the app is running against the mock adapter (server-derived, see `src/lib/config.ts`). */
export function useIsMock(): boolean {
  return useContext(MockModeContext);
}

export function AppProviders({ children, isMock }: { children: React.ReactNode; isMock: boolean }) {
  const [queryClient] = useState(() => makeQueryClient());

  // Activate the mock adapter synchronously on first render, BEFORE any
  // child effect can fire a request. A `useEffect` here runs too late —
  // child effects fire before parent effects — so a child's mount effect
  // (e.g. login page loading mock users) would race ahead of activation and
  // hit the real (unset) adapter. The lazy useState initializer runs once,
  // during render, ahead of children. Guarded to the browser only — the
  // `api` axios instance is a module-level singleton shared with the
  // server, so this must never run during SSR/prerender.
  useState(() => {
    if (isMock && typeof window !== "undefined") activateMockAdapter();
  });

  // Query keys carry no user scope: when a known identity ends (logout, incl. from another tab or a
  // 401) or is replaced by another user, drop every cached response so the next user never sees the
  // previous one's quotes / orders / customers while refetching. Bootstrap (no user → first user)
  // keeps the cache.
  useEffect(
    () =>
      useAuthStore.subscribe((state, previous) => {
        const before = previous.user?.userId;
        if (before && before !== state.user?.userId) queryClient.clear();
      }),
    [queryClient],
  );

  return (
    <MockModeContext.Provider value={isMock}>
      <QueryClientProvider client={queryClient}>
        <NuqsAdapter>{children}</NuqsAdapter>
      </QueryClientProvider>
    </MockModeContext.Provider>
  );
}
