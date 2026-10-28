"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Card } from "@/components/shared/Card";
import { Button } from "@/components/ui/button";
import { identityErrorMessage, identityFieldErrors } from "@/lib/api/identity-errors";
import { formatDateTime } from "@/lib/format/date";

import { USER_UI } from "../../constants";
import { hasTemporaryLock } from "../../lifecycle";
import { useUpdateUser } from "../../mutations";
import { updateUserFormSchema } from "../../schemas";
import { TextField } from "@/components/shared/TextField";
import { UserStatusBadge } from "../UserStatusBadge";

import type { UpdateUserFormValues, UserDto } from "../../types";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink-tertiary text-xs">{label}</dt>
      <dd className="text-ink-primary text-[0.8125rem]">{children}</dd>
    </div>
  );
}

/** Hồ sơ: sửa email / họ tên (gửi kèm `version` đã tải — BE 409 OPTIMISTIC_LOCK nếu đã đổi). Tên đăng nhập không đổi được. */
export function ProfileCard({
  user,
  canEdit,
  title,
}: {
  user: UserDto;
  canEdit: boolean;
  /** Tên hiển thị của tài khoản — tên nằm ở "Thông tin chung" vì trang chi tiết không có title. */
  title: string;
}) {
  const form = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserFormSchema),
    values: { email: user.email, fullName: user.fullName ?? "" },
  });
  const mutation = useUpdateUser();
  const { errors, isDirty } = form.formState;
  const fieldErrors = mutation.error ? identityFieldErrors(mutation.error) : [];

  const submit = form.handleSubmit((values) =>
    mutation.mutate({ userId: user.userId, values, version: user.version }),
  );
  const message = (name: keyof UpdateUserFormValues) =>
    errors[name]?.message ?? fieldErrors.find((item) => item.field === name)?.message;

  return (
    <Card>
      <h2 className="text-ink-primary text-base font-semibold">{title}</h2>
      <p className="text-ink-secondary mb-3 text-xs">{user.email}</p>
      <form
        onSubmit={(event) => void submit(event)}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <TextField label={USER_UI.usernameLabel} value={user.username} readOnly disabled />
        <TextField
          label={USER_UI.fullNameLabel}
          disabled={!canEdit}
          error={message("fullName")}
          {...form.register("fullName")}
        />
        <TextField
          label={USER_UI.emailLabel}
          type="text"
          inputMode="email"
          disabled={!canEdit}
          error={message("email")}
          {...form.register("email")}
        />
        <div className="flex items-end">
          {canEdit && (
            <Button type="submit" size="sm" disabled={!isDirty || mutation.isPending}>
              {mutation.isPending ? USER_UI.saving : "Lưu hồ sơ"}
            </Button>
          )}
        </div>
      </form>
      {mutation.error && fieldErrors.length === 0 && (
        <p role="alert" className="text-danger mt-3 text-[0.8125rem]">
          {identityErrorMessage(mutation.error)}
        </p>
      )}
      <dl className="border-border-default mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-3">
        <Fact label={USER_UI.statusLabel}>
          <UserStatusBadge status={user.status} />
        </Fact>
        <Fact label={USER_UI.lastLoginLabel}>
          {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : USER_UI.neverSignedIn}
        </Fact>
        <Fact label="Tạo lúc">
          {user.createdAt ? formatDateTime(user.createdAt) : "—"}
          {user.createdBy ? ` · ${user.createdBy}` : ""}
        </Fact>
      </dl>
      {user.mustChangePassword && (
        <p className="text-ink-secondary mt-3 text-xs">{USER_UI.mustChangePassword}.</p>
      )}
      {user.lockedUntil && hasTemporaryLock(user) && (
        <p className="text-warning mt-1 text-xs">
          {USER_UI.temporaryLock} {formatDateTime(user.lockedUntil)}.
        </p>
      )}
    </Card>
  );
}
