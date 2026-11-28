"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { APP_ROUTES } from "@/constants";
import { LOGIN_UI } from "@/constants/labels-login";

import { useIsMock } from "@/providers/app-providers";

import { CarPageLoader } from "@/components/shared/CarPageLoader";
import { GlassScreen } from "@/components/shared/GlassScreen";

import { getMockLoginUsersApi, loginApi, mockLoginApi } from "../../auth-api";
import { useAuthStore } from "../../auth-store";
import { loginErrorMessage } from "../../login-error";
import { landingFor } from "../../redirect";
import { useAuthLifecycle } from "../../use-auth-lifecycle";
import { CredentialLoginForm } from "./CredentialLoginForm";
import { LoginShell } from "./LoginShell";
import { SessionErrorState } from "../SessionErrorState";
import { MockLoginForm } from "./MockLoginForm";

import type { LoginResponse, MockLoginUser } from "../../auth-api";

export function LoginPageFallback() {
  return (
    <GlassScreen>
      <CarPageLoader label={LOGIN_UI.loading} />
    </GlassScreen>
  );
}

/** Trang đăng nhập — chọn tài khoản demo (mock) hoặc tên đăng nhập + mật khẩu thật qua BFF. */
export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedCallback = searchParams.get("callbackUrl");
  // Nhân viên → /admin, tài khoản khách (chỉ CUSTOMER) → /portal; callback khác khu vực bị bỏ.
  const roles = useAuthStore((state) => state.user?.roles);
  const callbackUrl = landingFor(roles ?? [], requestedCallback);
  const isMock = useIsMock();
  const { status, isAuthenticated, bootstrapError, retry } = useAuthLifecycle();
  const mustChangePassword = useAuthStore((state) => state.user?.mustChangePassword === true);

  useEffect(() => {
    // An administrator-set password has to be replaced first (SCRUM-474 FIRST-LOGIN).
    if (isAuthenticated)
      router.replace(mustChangePassword ? APP_ROUTES.changePassword : callbackUrl);
  }, [callbackUrl, isAuthenticated, mustChangePassword, router]);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mockUsers, setMockUsers] = useState<MockLoginUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isLoadingUsers, setIsLoadingUsers] = useState(isMock);

  useEffect(() => {
    if (!isMock) return;

    let cancelled = false;
    void getMockLoginUsersApi()
      .then((users) => {
        if (cancelled) return;
        setMockUsers(users);
        setSelectedUserId(users[0]?.userId ?? "");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : LOGIN_UI.mockUsersError);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingUsers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isMock]);

  function completeLogin(user: LoginResponse) {
    router.replace(
      user.mustChangePassword
        ? APP_ROUTES.changePassword
        : landingFor(useAuthStore.getState().user?.roles ?? [], requestedCallback),
    );
    router.refresh();
  }

  function runLogin(login: () => Promise<LoginResponse>) {
    setError(null);
    startTransition(async () => {
      try {
        completeLogin(await login());
      } catch (loginError: unknown) {
        setError(loginErrorMessage(loginError));
      }
    });
  }

  if (status === "unknown" && bootstrapError)
    return <SessionErrorState message={bootstrapError} onRetry={retry} />;
  if (status === "unknown" || isAuthenticated) return <LoginPageFallback />;

  return (
    <LoginShell isMock={isMock}>
      <h1 className="text-ink-primary font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
        {LOGIN_UI.title}
      </h1>
      <p className="text-ink-secondary mt-1.5 text-sm">
        {isMock ? LOGIN_UI.mockDescription : LOGIN_UI.description}
      </p>

      {error && (
        <div
          role="alert"
          className="border-danger/30 bg-danger/10 text-danger mt-6 rounded-[var(--r-md)] border px-3 py-2.5 text-sm"
        >
          {error}
        </div>
      )}

      <div className="mt-5">
        {isMock ? (
          <MockLoginForm
            users={mockUsers}
            loading={isLoadingUsers}
            selectedUserId={selectedUserId}
            onSelect={setSelectedUserId}
            pending={isPending}
            onSubmit={() => {
              if (selectedUserId) runLogin(() => mockLoginApi(selectedUserId));
            }}
          />
        ) : (
          <CredentialLoginForm
            pending={isPending}
            onSubmit={(credentials) => runLogin(() => loginApi(credentials))}
          />
        )}
      </div>
    </LoginShell>
  );
}
