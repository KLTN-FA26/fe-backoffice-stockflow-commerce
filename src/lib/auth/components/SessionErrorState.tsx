"use client";

import { CircleAlert, RotateCw } from "lucide-react";
import { useId } from "react";

import { AUTH_UI } from "@/constants/auth";

import { GlassScreen } from "@/components/shared/GlassScreen";
import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";

interface SessionErrorStateProps {
  /** bootstrapError from the auth store — shown in the dialog header. */
  message: string;
  onRetry: () => void;
  /** Extra button left of "Thử lại" (e.g. "Đăng xuất" on the change-password page). */
  secondaryAction?: ReactNode;
}

/** Footer button size, shared with the page's secondaryAction so both match. */
export const SESSION_ERROR_ACTION_CLASS = "h-8 rounded-[var(--r-md)] px-3 text-[0.8125rem]";

/**
 * Plain system-message dialog for a session that could not be verified (5xx / network on
 * GET /auth/me). The session stays `unknown`, not signed out, so the main action is retry.
 */
export function SessionErrorState({ message, onRetry, secondaryAction }: SessionErrorStateProps) {
  const titleId = useId();
  return (
    <GlassScreen>
      <section
        role="alert"
        aria-labelledby={titleId}
        className="border-border-default bg-bg-surface w-full max-w-md overflow-hidden rounded-[var(--r-md)] border shadow-[var(--sh-sm)]"
      >
        <header className="border-border-default bg-bg-subtle flex items-center gap-2 border-b px-4 py-2.5">
          <CircleAlert className="text-danger size-4 shrink-0" aria-hidden="true" />
          <h1 id={titleId} className="text-ink-primary text-sm font-semibold">
            {message}
          </h1>
        </header>
        <p className="text-ink-secondary px-4 py-3.5 text-sm">{AUTH_UI.bootstrapErrorHint}</p>
        <footer className="border-border-default bg-bg-subtle flex justify-end gap-2 border-t px-4 py-2.5">
          {secondaryAction}
          <Button className={SESSION_ERROR_ACTION_CLASS} onClick={onRetry}>
            <RotateCw aria-hidden="true" />
            {AUTH_UI.retry}
          </Button>
        </footer>
      </section>
    </GlassScreen>
  );
}
