"use client";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { identityErrorMessage } from "@/lib/api/identity-errors";

import { ROLE_ADMIN } from "../role-admin-constants";
import { useDeleteRole } from "../role-mutations";

import type { RoleResponse } from "../types";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteRoleDialog({
  open,
  onOpenChange,
  role,
  onDeleted,
}: DialogProps & { role: RoleResponse; onDeleted: () => void }) {
  const mutation = useDeleteRole();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (next) mutation.reset();
        onOpenChange(next);
      }}
      title={ROLE_ADMIN.deleteTitle}
      description={`Vai trò "${role.name}" (${role.code}) sẽ bị xoá vĩnh viễn cùng toàn bộ quyền đã tick. Chỉ xoá được khi không còn ai giữ vai trò này.`}
      confirmLabel={ROLE_ADMIN.remove}
      closeOnConfirm={false}
      loading={mutation.isPending}
      error={mutation.error ? identityErrorMessage(mutation.error) : undefined}
      onConfirm={() =>
        mutation.mutate(role.code, {
          onSuccess: () => {
            onOpenChange(false);
            onDeleted();
          },
        })
      }
    />
  );
}
