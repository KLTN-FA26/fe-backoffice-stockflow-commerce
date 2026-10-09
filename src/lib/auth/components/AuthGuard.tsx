"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { APP_ROUTES } from "@/constants";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { useAuthStore } from "../auth-store";
import { useAuthLifecycle } from "../use-auth-lifecycle";

import type { ReactNode } from "react";

/** Client gate only. Backend APIs remain the authority for session validity. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { hasHydrated, isAuthenticated } = useAuthLifecycle();

  useEffect(() => {
    if (!hasHydrated || !useAuthStore.persist.hasHydrated()) return;
    // Remove an orphan routing hint before /login can be intercepted by the proxy.
    useAuthStore.getState().synchronizeCookie();
    if (!isAuthenticated) router.replace(APP_ROUTES.login);
  }, [hasHydrated, isAuthenticated, router]);

  if (!hasHydrated || !isAuthenticated) {
    return (
      <main className="bg-bg-base min-h-screen p-[var(--card-pad)]">
        <PageSkeleton />
      </main>
    );
  }
  return children;
}
