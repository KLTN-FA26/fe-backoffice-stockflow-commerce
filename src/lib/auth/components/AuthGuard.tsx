"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { APP_ROUTES } from "@/constants";
import { AUTH_UI } from "@/constants/auth";

import { CarPageLoader } from "@/components/shared/CarPageLoader";
import { Button } from "@/components/ui/button";

import { useAuthLifecycle } from "../use-auth-lifecycle";

import type { ReactNode } from "react";

/**
 * Client gate only. Backend APIs remain the authority for session validity.
 * While /auth/me is pending it shows the same truck loader as the login page (not a page
 * skeleton): the guard sits above the shell, so a skeleton here would flash a shell-less
 * layout before the route's own loading.tsx.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, isAuthenticated, bootstrapError, retry } = useAuthLifecycle();

  useEffect(() => {
    if (status === "unauthenticated") router.replace(APP_ROUTES.login);
  }, [status, router]);

  if (!isAuthenticated) {
    return (
      <main className="bg-bg-base flex min-h-screen items-center justify-center px-6">
        {bootstrapError ? (
          <div role="alert" className="text-ink-primary flex flex-col items-center gap-3 text-sm">
            {bootstrapError}
            <Button size="sm" onClick={retry}>
              {AUTH_UI.retry}
            </Button>
          </div>
        ) : (
          <CarPageLoader label={AUTH_UI.verifyingSession} />
        )}
      </main>
    );
  }
  return children;
}
