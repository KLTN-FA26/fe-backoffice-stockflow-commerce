"use client";

import { useState } from "react";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { identityErrorMessage } from "@/lib/api/identity-errors";

import { USER_LIMITS, USER_UI } from "../../constants";
import { useResetPassword } from "../../mutations";
import { resetPasswordFormSchema } from "../../schemas";
import { TextField } from "@/components/shared/TextField";

import type { PasswordResetResult } from "../../types";

interface ResetPasswordDialogProps {
  userId: string;
  accountLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (result: PasswordResetResult) => void;
}

function ResetForm({
  userId,
  accountLabel,
  onCancel,
  onDone,
}: Omit<ResetPasswordDialogProps, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const mutation = useResetPassword();
  const [password, setPassword] = useState("");
  const parsed = resetPasswordFormSchema.safeParse({ newPassword: password });
  const invalid = parsed.success ? undefined : parsed.error.issues[0]?.message;

  return (
    <FormDialogBody
      title={USER_UI.resetPassword}
      description={`Đặt mật khẩu tạm cho ${accountLabel}. Tài khoản bị đăng xuất khỏi mọi thiết bị; người dùng nên đổi mật khẩu sau khi đăng nhập.`}
      submitLabel={USER_UI.resetPassword}
      canSubmit={!invalid}
      isPending={mutation.isPending}
      error={mutation.error ? identityErrorMessage(mutation.error) : null}
      danger
      onSubmit={() =>
        mutation.mutate(
          { userId, newPassword: password || undefined },
          {
            onSuccess: (result) => {
              onDone(result);
              mutation.reset();
            },
          },
        )
      }
      onCancel={onCancel}
    >
      <TextField
        label="Mật khẩu mới"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        hint={`Tuỳ chọn. Bỏ trống để hệ thống tự sinh. ${USER_LIMITS.passwordMin}–${USER_LIMITS.passwordMax} ký tự, gồm chữ hoa, chữ thường và chữ số.`}
        error={password ? invalid : undefined}
      />
    </FormDialogBody>
  );
}

export function ResetPasswordDialog({ open, onOpenChange, ...rest }: ResetPasswordDialogProps) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      <ResetForm {...rest} onCancel={() => onOpenChange(false)} />
    </FormDialog>
  );
}
