"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { LOGIN_UI } from "@/constants/labels-login";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { loginRequestSchema } from "../../auth-schemas";

import type { LoginRequest } from "../../auth-schemas";

interface CredentialLoginFormProps {
  pending: boolean;
  onSubmit: (credentials: LoginRequest) => void;
}

const EMPTY: LoginRequest = { username: "", password: "" };
const INPUT_CLASS = "bg-bg-surface h-10 rounded-[var(--r-md)]";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-danger text-xs">
      {message}
    </p>
  );
}

/**
 * Đăng nhập thật qua BFF — BE chỉ nhận tên đăng nhập + mật khẩu. react-hook-form + zodResolver
 * (`loginRequestSchema`, cùng schema BFF parse body); `noValidate` tắt bong bóng validate của trình duyệt.
 */
export function CredentialLoginForm({ pending, onSubmit }: CredentialLoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({ resolver: zodResolver(loginRequestSchema), defaultValues: EMPTY });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="username">{LOGIN_UI.usernameLabel}</Label>
        <Input
          id="username"
          type="text"
          placeholder={LOGIN_UI.usernamePlaceholder}
          autoComplete="username"
          autoFocus
          aria-invalid={errors.username ? true : undefined}
          aria-describedby={errors.username ? "username-error" : undefined}
          className={INPUT_CLASS}
          {...register("username")}
        />
        <FieldError id="username-error" message={errors.username?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">{LOGIN_UI.passwordLabel}</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder={LOGIN_UI.passwordPlaceholder}
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "password-error" : undefined}
            className={`${INPUT_CLASS} pr-10`}
            {...register("password")}
          />
          {/* Nút thường, căn giữa bằng inset + my-auto: Button của shadcn có `active:translate-y-px`
              đè lên `-translate-y-1/2` nên mỗi lần bấm nút giật lên xuống. */}
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="text-ink-tertiary hover:text-ink-primary hover:bg-bg-muted focus-visible:ring-border-strong absolute inset-y-0 right-0.5 my-auto flex size-9 items-center justify-center rounded-[var(--r-sm)] transition-colors focus-visible:ring-2 focus-visible:outline-none"
            aria-label={showPassword ? LOGIN_UI.hidePassword : LOGIN_UI.showPassword}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        <FieldError id="password-error" message={errors.password?.message} />
      </div>

      <Button type="submit" className="h-10 w-full rounded-[var(--r-md)]" disabled={pending}>
        {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        {pending ? LOGIN_UI.submitting : LOGIN_UI.submit}
      </Button>
    </form>
  );
}
