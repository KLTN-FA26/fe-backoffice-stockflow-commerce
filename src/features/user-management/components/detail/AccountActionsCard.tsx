"use client";

import { useState } from "react";

import { Card } from "@/components/shared/Card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { identityErrorMessage } from "@/lib/api/identity-errors";

import { allowedStatusActions } from "../../lifecycle";
import { STATUS_SUCCESS_MESSAGES, useChangeUserStatus } from "../../mutations";
import { TemporaryPasswordDialog } from "../TemporaryPasswordDialog";

import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { STATUS_ACTION_COPY } from "./status-actions";

import type { PasswordResetResult, UserDto, UserStatusAction } from "../../types";

/** Khoá / mở khoá / vô hiệu hoá / kích hoạt lại (có xác nhận) và đặt lại mật khẩu. Hành động nào hợp lệ do `lifecycle.ts` quyết. */
export function AccountActionsCard({
  user,
  canEdit,
  accountLabel,
}: {
  user: UserDto;
  canEdit: boolean;
  accountLabel: string;
}) {
  const mutation = useChangeUserStatus();
  const [action, setAction] = useState<UserStatusAction | null>(null);
  const [resetting, setResetting] = useState(false);
  const [issued, setIssued] = useState<PasswordResetResult | null>(null);
  const copy = action ? STATUS_ACTION_COPY[action] : null;

  const open = (next: UserStatusAction) => {
    mutation.reset();
    setAction(next);
  };

  return (
    <Card>
      <h2 className="text-ink-primary mb-3 text-sm font-semibold">Trạng thái và mật khẩu</h2>
      {!canEdit ? (
        <p className="text-ink-tertiary text-xs">Bạn không có thao tác nào với tài khoản này.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {allowedStatusActions(user).map((next) => (
            <Button key={next} type="button" size="sm" variant="outline" onClick={() => open(next)}>
              {STATUS_ACTION_COPY[next].button}
            </Button>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={() => setResetting(true)}>
            Đặt lại mật khẩu
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={action !== null}
        onOpenChange={(next) => !next && setAction(null)}
        title={copy?.title ?? ""}
        description={copy ? `${accountLabel}: ${copy.description}` : ""}
        confirmLabel={copy?.confirm}
        variant={copy?.danger ? "danger" : "default"}
        closeOnConfirm={false}
        loading={mutation.isPending}
        error={mutation.error ? identityErrorMessage(mutation.error) : undefined}
        onConfirm={() =>
          action &&
          mutation.mutate(
            { userId: user.userId, action },
            {
              onSuccess: () => {
                toast.success(STATUS_SUCCESS_MESSAGES[action]);
                setAction(null);
              },
            },
          )
        }
      />
      <ResetPasswordDialog
        userId={user.userId}
        accountLabel={accountLabel}
        open={resetting}
        onOpenChange={setResetting}
        onDone={(result) => {
          setResetting(false);
          if (result.temporaryPassword) setIssued(result);
        }}
      />
      <TemporaryPasswordDialog
        password={issued?.temporaryPassword ?? null}
        accountLabel={accountLabel}
        reason="reset"
        sessionsEnded={issued?.sessionsEnded}
        onClose={() => setIssued(null)}
      />
    </Card>
  );
}
