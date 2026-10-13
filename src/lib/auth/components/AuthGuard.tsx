"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AUTH_UI } from "@/constants/auth";

import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { loginUrlFor } from "../redirect";
import { useAuthLifecycle } from "../use-auth-lifecycle";

import type { ReactNode } from "react";

/** Client gate only. Backend APIs remain the authority for session validity. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, isAuthenticated, bootstrapError, retry } = useAuthLifecycle();

  useEffect(() => {
    // Hết phiên giữa chừng → đăng nhập lại rồi quay về đúng trang + bộ lọc đang xem.
    if (status !== "unauthenticated") return;
    const { pathname, search } = window.location;
    router.replace(loginUrlFor(`${pathname}${search}`));
  }, [status, router]);

  if (!isAuthenticated) {
    return (
      <main className="bg-bg-base min-h-screen p-[var(--card-pad)]">
        {bootstrapError && (
          <div role="alert">
            {bootstrapError}
            <Button onClick={retry}>{AUTH_UI.retry}</Button>
          </div>
        )}
        <PageSkeleton />
      </main>
    );
  }
  return children;
}
