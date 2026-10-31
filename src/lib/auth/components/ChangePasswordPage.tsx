"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { ADMIN_ROUTES, APP_ROUTES } from "@/constants";
import {
  AUTH_UI,
  CHANGE_PASSWORD_ERROR_MESSAGES,
  CHANGE_PASSWORD_FALLBACK,
  CHANGE_PASSWORD_UI,
} from "@/constants/auth";

import { ApiError } from "@/lib/api/error";

import { CarPageLoader } from "@/components/shared/CarPageLoader";
import { CheckboxField } from "@/components/shared/CheckboxField";
import { TextField } from "@/components/shared/TextField";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { changePasswordApi, logoutApi } from "../auth-api";
import { changePasswordFormSchema } from "../auth-schemas";
import { useAuthStore } from "../auth-store";
import { useAuthLifecycle } from "../use-auth-lifecycle";

import type { ChangePasswordFormValues } from "../auth-schemas";

const EMPTY: ChangePasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
  logoutOtherDevices: false,
};

const MESSAGES_BY_CODE: Readonly<Record<string, string | undefined>> =
  CHANGE_PASSWORD_ERROR_MESSAGES;

/** Copy for a failed change; branches on the stable ApiError.code, never on the server's wording. */
export function changePasswordErrorMessage(error: unknown): string {
  if (error instanceof ApiError)
    return (
      (Object.hasOwn(MESSAGES_BY_CODE, error.code) && MESSAGES_BY_CODE[error.code]) ||
      CHANGE_PASSWORD_FALLBACK
    );
  return CHANGE_PASSWORD_FALLBACK;
}

/**
 * Self-service password change for every staff user (SCRUM-474 FIRST-LOGIN, decision 29/10/2026).
 *
 * Two entries: the user menu (voluntary - "sign out other devices" is the user's choice, as the docs
 * say) and the forced redirect after sign-in or a 403 PASSWORD_CHANGE_REQUIRED. When forced, the BE
 * always ends every other session and keeps this one, so the tick is hidden and the only other way
 * out is signing out. The page sits outside /admin: a forced user must not reach the shell.
 */
export function ChangePasswordPage() {
  const router = useRouter();
  const { status, isAuthenticated, bootstrapError, retry } = useAuthLifecycle();
  const forced = useAuthStore((state) => state.user?.mustChangePassword === true);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (status === "unauthenticated") router.replace(APP_ROUTES.login);
  }, [status, router]);

  async function logout() {
    try {
      await logoutApi();
    } finally {
      router.replace(APP_ROUTES.login);
      router.refresh();
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="bg-bg-base flex min-h-screen items-center justify-center px-6">
        {bootstrapError ? (
          <div role="alert" className="text-ink-primary flex flex-col items-center gap-3 text-sm">
            {bootstrapError}
            <div className="flex gap-2">
              <Button size="sm" onClick={retry}>
                {AUTH_UI.retry}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void logout()}>
                {CHANGE_PASSWORD_UI.logout}
              </Button>
            </div>
          </div>
        ) : (
          <CarPageLoader label={AUTH_UI.verifyingSession} />
        )}
      </main>
    );
  }

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    setPending(true);
    try {
      const result = await changePasswordApi({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        logoutOtherDevices: forced || values.logoutOtherDevices,
      });
      toast.success(CHANGE_PASSWORD_UI.successOthers(result.revokedSessions));
      router.replace(ADMIN_ROUTES.home);
      router.refresh();
    } catch (error: unknown) {
      const message = changePasswordErrorMessage(error);
      if (error instanceof ApiError && error.code === "INVALID_CURRENT_PASSWORD")
        form.setError("currentPassword", { message });
      else setFormError(message);
    } finally {
      setPending(false);
    }
  });

  const { errors } = form.formState;
  return (
    <main className="bg-bg-base flex min-h-screen items-center justify-center px-6 py-10">
      <section className="border-border-default bg-bg-surface w-full max-w-md rounded-[var(--r-md)] border p-8 shadow-[var(--sh-lg)]">
        <div className="bg-bg-subtle text-accent mb-5 flex size-11 items-center justify-center rounded-[var(--r-sm)]">
          <KeyRound className="size-5" aria-hidden="true" />
        </div>
        <h1 className="text-ink-primary font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          {forced ? CHANGE_PASSWORD_UI.forcedTitle : CHANGE_PASSWORD_UI.title}
        </h1>
        <p className="text-ink-secondary mt-2 text-sm leading-6">
          {forced ? CHANGE_PASSWORD_UI.forcedDescription : CHANGE_PASSWORD_UI.description}
        </p>

        {formError && (
          <div
            role="alert"
            className="border-danger/30 bg-danger/10 text-danger mt-5 rounded-[var(--r-sm)] border px-4 py-3 text-sm"
          >
            {formError}
          </div>
        )}

        <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
          <TextField
            label={CHANGE_PASSWORD_UI.currentLabel}
            type="password"
            autoComplete="current-password"
            required
            error={errors.currentPassword?.message}
            {...form.register("currentPassword")}
          />
          <TextField
            label={CHANGE_PASSWORD_UI.newLabel}
            type="password"
            autoComplete="new-password"
            required
            hint={CHANGE_PASSWORD_UI.newHint}
            error={errors.newPassword?.message}
            {...form.register("newPassword")}
          />
          <TextField
            label={CHANGE_PASSWORD_UI.confirmLabel}
            type="password"
            autoComplete="new-password"
            required
            error={errors.confirmPassword?.message}
            {...form.register("confirmPassword")}
          />
          {!forced && (
            <CheckboxField
              control={form.control}
              name="logoutOtherDevices"
              label={CHANGE_PASSWORD_UI.logoutOthersLabel}
            />
          )}
          <Button
            type="submit"
            size="lg"
            className="w-full rounded-[var(--r-sm)]"
            disabled={pending}
          >
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            {pending ? CHANGE_PASSWORD_UI.submitting : CHANGE_PASSWORD_UI.submit}
          </Button>
        </form>

        <div className="mt-4 flex justify-center">
          {forced ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => void logout()}>
              {CHANGE_PASSWORD_UI.logout}
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href={ADMIN_ROUTES.home}>{CHANGE_PASSWORD_UI.back}</Link>
            </Button>
          )}
        </div>
      </section>
    </main>
  );
}
