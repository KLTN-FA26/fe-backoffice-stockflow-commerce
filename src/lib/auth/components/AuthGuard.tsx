"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AUTH_UI } from "@/constants/auth";

import { CarPageLoader } from "@/components/shared/CarPageLoader";
import { GlassScreen } from "@/components/shared/GlassScreen";

import { loginUrlFor } from "../redirect";
import { useAuthLifecycle } from "../use-auth-lifecycle";
import { SessionErrorState } from "./SessionErrorState";

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
    // Hết phiên giữa chừng → đăng nhập lại rồi quay về đúng trang + bộ lọc đang xem.
    if (status !== "unauthenticated") return;
    const { pathname, search } = window.location;
    router.replace(loginUrlFor(`${pathname}${search}`));
  }, [status, router]);

  if (bootstrapError && !isAuthenticated)
    return <SessionErrorState message={bootstrapError} onRetry={retry} />;
  if (!isAuthenticated) {
    return (
      <GlassScreen>
        <CarPageLoader label={AUTH_UI.verifyingSession} />
      </GlassScreen>
    );
  }
  return children;
}
