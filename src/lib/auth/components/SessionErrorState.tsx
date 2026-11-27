"use client";

import { RotateCw, ShieldAlert } from "lucide-react";
import { useId } from "react";

import { AUTH_UI } from "@/constants/auth";

import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";

interface SessionErrorStateProps {
  /** bootstrapError from the auth store — shown as the card title. */
  message: string;
  onRetry: () => void;
  /** Extra full-width button under "Thử lại" (e.g. "Đăng xuất" on the change-password page). */
  secondaryAction?: ReactNode;
}

/**
 * Full-page card for a session that could not be verified (5xx / network on GET /auth/me).
 * The session is still `unknown`, not signed out — so the copy says so and the main action is retry.
 */
export function SessionErrorState({ message, onRetry, secondaryAction }: SessionErrorStateProps) {
  const titleId = useId();
  return (
    <main className="bg-bg-base flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <Logo variant="mark" height={32} decorative />
      <section
        role="alert"
        aria-labelledby={titleId}
        className="border-border-default bg-bg-surface w-full max-w-sm rounded-[var(--r-md)] border p-6 text-center shadow-[var(--sh-sm)]"
      >
        <div className="bg-danger/10 text-danger mx-auto flex size-11 items-center justify-center rounded-full">
          <ShieldAlert className="size-5" aria-hidden="true" />
        </div>
        <h1 id={titleId} className="text-ink-primary mt-4 text-base font-semibold">
          {message}
        </h1>
        <p className="text-ink-secondary mt-1.5 text-sm leading-6">{AUTH_UI.bootstrapErrorHint}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button className="h-10 w-full rounded-[var(--r-md)]" onClick={onRetry}>
            <RotateCw aria-hidden="true" />
            {AUTH_UI.retry}
          </Button>
          {secondaryAction}
        </div>
      </section>
    </main>
  );
}
