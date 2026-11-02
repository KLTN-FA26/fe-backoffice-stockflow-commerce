"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { APP_ROUTES } from "@/constants";
import { AUTH_UI } from "@/constants/auth";

import { CarPageLoader } from "@/components/shared/CarPageLoader";

import { useAuthStore } from "../auth-store";

import type { ReactNode } from "react";

/**
 * SCRUM-474 FIRST-LOGIN: an account that still has an administrator-set password gets nothing from
 * `/admin/**` (the BE answers every call but four with 403 PASSWORD_CHANGE_REQUIRED), so it is sent to
 * the change-password page instead of being shown a shell full of failing requests. Sits inside
 * `AuthGuard`, so a user is known by the time it renders. UI-only: the BE gate is the authority.
 */
export function PasswordChangeGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const mustChange = useAuthStore((state) => state.user?.mustChangePassword === true);

  useEffect(() => {
    if (mustChange) router.replace(APP_ROUTES.changePassword);
  }, [mustChange, router]);

  if (mustChange) {
    return (
      <main className="bg-bg-base flex min-h-screen items-center justify-center px-6">
        <CarPageLoader label={AUTH_UI.verifyingSession} />
      </main>
    );
  }
  return children;
}
