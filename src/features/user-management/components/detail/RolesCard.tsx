"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { Card } from "@/components/shared/Card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { Button } from "@/components/ui/button";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { identityErrorMessage } from "@/lib/api/identity-errors";
import { roleLabel } from "@/lib/references/role-options";

import { USER_UI } from "../../constants";
import { useAssignRole, useRevokeRole } from "../../mutations";
import { isAssignableRole } from "../../selectors";

import type { RoleOption } from "@/lib/references/role-options";
import type { UserDto } from "../../types";

interface RolesCardProps {
  user: UserDto;
  canEdit: boolean;
  /** Danh mục vai trò; `null` khi không có quyền đọc (chỉ hiện mã, không gán thêm được). */
  roles: readonly RoleOption[] | null;
}

/** Vai trò của tài khoản: gỡ (có xác nhận) và gán thêm. Mỗi thao tác là một request riêng (`/users/{id}/roles`). */
export function RolesCard({ user, canEdit, roles }: RolesCardProps) {
  const assign = useAssignRole();
  const revoke = useRevokeRole();
  const [picked, setPicked] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const held = new Set(user.roles);
  const available = (roles ?? []).filter(
    (role) => !held.has(role.code) && isAssignableRole(role.code),
  );

  return (
    <Card>
      <h2 className="text-ink-primary mb-3 text-sm font-semibold">{USER_UI.rolesLabel}</h2>
      {user.roles.length === 0 ? (
        <p className="text-ink-tertiary text-xs">{USER_UI.noRoles}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {user.roles.map((code) => (
            <li
              key={code}
              className="border-border-default bg-bg-subtle text-ink-primary inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-3 text-[0.8125rem]"
            >
              {roleLabel(roles ?? undefined, code)}
              {canEdit && (
                <button
                  type="button"
                  aria-label={`Gỡ vai trò ${roleLabel(roles ?? undefined, code)}`}
                  className="hover:bg-bg-muted rounded-full p-1"
                  onClick={() => {
                    revoke.reset();
                    setRemoving(code);
                  }}
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && roles && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Select value={picked} onValueChange={setPicked}>
            <SelectTrigger
              aria-label="Chọn vai trò để gán"
              className={`${FORM_SELECT_CLASS} sm:w-64`}
            >
              <SelectValue placeholder="Chọn vai trò để gán" />
            </SelectTrigger>
            <TitledSelectContent title="Vai trò chưa gán">
              {available.map((role) => (
                <SelectItem key={role.code} value={role.code}>
                  {role.name}
                </SelectItem>
              ))}
            </TitledSelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            disabled={!picked || assign.isPending}
            onClick={() =>
              assign.mutate(
                { userId: user.userId, roleCode: picked },
                { onSuccess: () => setPicked("") },
              )
            }
          >
            {assign.isPending ? "Đang gán…" : "Gán vai trò"}
          </Button>
        </div>
      )}
      {canEdit && !roles && (
        <p className="text-ink-tertiary mt-3 text-xs">
          Bạn không có quyền xem danh sách vai trò nên chỉ gỡ được vai trò, chưa gán thêm được.
        </p>
      )}
      {assign.error && (
        <p role="alert" className="text-danger mt-3 text-[0.8125rem]">
          {identityErrorMessage(assign.error)}
        </p>
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Gỡ vai trò?"
        description={`Người dùng sẽ mất toàn bộ quyền của vai trò "${removing ? roleLabel(roles ?? undefined, removing) : ""}" ở request kế tiếp.`}
        confirmLabel="Gỡ vai trò"
        closeOnConfirm={false}
        loading={revoke.isPending}
        error={revoke.error ? identityErrorMessage(revoke.error) : undefined}
        onConfirm={() =>
          removing &&
          revoke.mutate(
            { userId: user.userId, roleCode: removing },
            { onSuccess: () => setRemoving(null) },
          )
        }
      />
    </Card>
  );
}
