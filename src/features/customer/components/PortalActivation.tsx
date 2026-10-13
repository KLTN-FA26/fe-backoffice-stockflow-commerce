"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";

import { APP_ROUTES } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { WEAK_PASSWORD_MESSAGE, customerErrorMessage } from "@/features/customer/errors";
import { useActivatePortalAccount } from "@/features/customer/mutations";
import { invitationTokenSchema, portalActivationInputSchema } from "@/features/customer/schemas";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Logo } from "@/components/shared/Logo";
import { useStorefrontMode } from "@/components/storefront/use-storefront-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { PortalActivationValues } from "@/features/customer/types";

/** BE gửi link dạng `/portal/activate#token=…` (fragment không đi lên server / log). */
function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
function readToken(): string {
  return new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token") ?? "";
}

const noopSubscribe = () => () => {};

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <main
      data-mode="storefront"
      className="bg-bg-base text-ink-primary flex min-h-screen items-center justify-center px-4 py-10"
    >
      <div className="bg-bg-surface border-border-default w-full max-w-md space-y-5 rounded-[var(--r-xl)] border p-6 shadow-[var(--sh-md)] sm:p-8">
        <Logo height={32} />
        {children}
      </div>
    </main>
  );
}

function InvalidLink({ message }: { message: string }) {
  return (
    <div role="alert" className="space-y-3">
      <TriangleAlert className="text-warning size-8" aria-hidden="true" />
      <h1 className="font-[family-name:var(--font-display)] text-xl font-bold">
        Link kích hoạt không dùng được
      </h1>
      <p className="text-ink-secondary text-sm">{message}</p>
    </div>
  );
}

export function PortalActivation() {
  useStorefrontMode();
  const token = useSyncExternalStore(subscribeHash, readToken, () => "");
  // Server không thấy fragment → chờ client đọc xong mới quyết định link hợp lệ (tránh nháy lỗi).
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const [invalid, setInvalid] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const activate = useActivatePortalAccount();
  const form = useForm<PortalActivationValues>({
    resolver: zodResolver(portalActivationInputSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onTouched",
  });
  const { errors } = form.formState;

  if (!hydrated)
    return (
      <Panel>
        <p role="status" className="text-ink-secondary text-sm">
          Đang kiểm tra link kích hoạt…
        </p>
      </Panel>
    );

  if (activate.isSuccess)
    return (
      <Panel>
        <div role="status" className="space-y-3">
          <CheckCircle2 className="text-positive size-8" aria-hidden="true" />
          <h1 className="font-[family-name:var(--font-display)] text-xl font-bold">
            Đã kích hoạt tài khoản
          </h1>
          <p className="text-ink-secondary text-sm">
            Đăng nhập bằng email{" "}
            <strong className="text-ink-primary break-all">{activate.data.email}</strong> và mật
            khẩu vừa đặt.
          </p>
          <Button asChild className="min-h-11 w-full">
            <Link href={APP_ROUTES.login}>Đăng nhập</Link>
          </Button>
        </div>
      </Panel>
    );

  if (!invitationTokenSchema.safeParse(token).success || invalid)
    return (
      <Panel>
        <InvalidLink
          message={
            invalid ??
            "Link thiếu hoặc sai mã kích hoạt. Mở lại đúng link trong email mời, hoặc liên hệ bộ phận bán hàng để được gửi lời mời mới."
          }
        />
      </Panel>
    );

  const submit = form.handleSubmit(({ password }) => {
    setFormError(null);
    activate.mutate(
      { token, password },
      {
        onError: (error) => {
          if (error instanceof ApiError && error.code === "PORTAL_INVITATION_INVALID") {
            setInvalid(customerErrorMessage(error));
          } else if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
            form.setError("password", { type: "server", message: WEAK_PASSWORD_MESSAGE });
          } else {
            setFormError(customerErrorMessage(error));
          }
        },
      },
    );
  });

  return (
    <Panel>
      <div className="space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-bold">
          Kích hoạt tài khoản portal
        </h1>
        <p className="text-ink-secondary text-sm">
          Đặt mật khẩu để xem báo giá, duyệt mẫu và theo dõi đơn hàng.
        </p>
      </div>
      <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
        <FormField
          id="activate-password"
          label="Mật khẩu"
          required
          error={errors.password?.message}
          hint="10–72 ký tự, có chữ hoa, chữ thường và chữ số."
        >
          <Input
            {...form.register("password")}
            {...fieldA11y("activate-password", errors.password?.message, true)}
            type="password"
            autoComplete="new-password"
            autoFocus
            className={`${FORM_INPUT_CLASS} h-11`}
          />
        </FormField>
        <FormField
          id="activate-confirm"
          label="Nhập lại mật khẩu"
          required
          error={errors.confirmPassword?.message}
        >
          <Input
            {...form.register("confirmPassword")}
            {...fieldA11y("activate-confirm", errors.confirmPassword?.message)}
            type="password"
            autoComplete="new-password"
            className={`${FORM_INPUT_CLASS} h-11`}
          />
        </FormField>
        {formError && (
          <p role="alert" className="text-danger text-sm">
            {formError}
          </p>
        )}
        <Button type="submit" className="min-h-11 w-full" disabled={activate.isPending}>
          {activate.isPending && (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          )}
          Kích hoạt tài khoản
        </Button>
      </form>
    </Panel>
  );
}
