"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { IDENTITY_PERMISSIONS } from "@/constants/permissions";
import { DATA_SCOPE_LABELS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";

import { ROLE_ADMIN } from "../role-admin-constants";

import { CreateRoleDialog } from "./CreateRoleDialog";
import { DeleteRoleDialog } from "./DeleteRoleDialog";
import { EditRoleDialog } from "./EditRoleDialog";

import type { RoleResponse } from "../types";

/**
 * Thanh quản lý vai trò trên màn Phân quyền: tạo vai trò mới, đổi tên / xoá vai trò tuỳ chỉnh đang chọn.
 * Mỗi nút gắn MÃ QUYỀN riêng (`identity-roles:CREATE/UPDATE/DELETE`); vai trò hệ thống không có nút sửa / xoá.
 * UI-only — BE re-check và trả SYSTEM_ROLE_IMMUTABLE / ROLE_IN_USE.
 */
export function RoleAdminBar({
  roles,
  selected,
  onSelect,
  disabled = false,
}: {
  roles: readonly RoleResponse[];
  selected: RoleResponse | undefined;
  onSelect: (roleCode: string) => void;
  /** Đang lưu / tải lại ma trận: khoá mọi thao tác trên vai trò để không đổi vai trò giữa chừng. */
  disabled?: boolean;
}) {
  const canCreate = useCan(IDENTITY_PERMISSIONS.rolesCreate);
  const canUpdate = useCan(IDENTITY_PERMISSIONS.rolesUpdate);
  const canDelete = useCan(IDENTITY_PERMISSIONS.rolesDelete);
  const [dialog, setDialog] = useState<"create" | "edit" | "delete" | null>(null);
  const custom = selected && !selected.system ? selected : undefined;
  const close = (open: boolean) => !open && setDialog(null);

  return (
    <div className="border-border-default bg-bg-surface space-y-3 rounded-[var(--card-radius)] border p-4 shadow-(--card-shadow)">
      {selected && (
        <p className="text-ink-secondary text-xs">
          <span className="text-ink-primary font-medium">{selected.code}</span> ·{" "}
          {DATA_SCOPE_LABELS[selected.dataScope]} · {ROLE_ADMIN.holders(selected.holderCount)}.{" "}
          {selected.system ? ROLE_ADMIN.systemNote : ROLE_ADMIN.customNote}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {canCreate && (
          <Button type="button" size="sm" disabled={disabled} onClick={() => setDialog("create")}>
            <Plus className="size-3.5" /> {ROLE_ADMIN.create}
          </Button>
        )}
        {canUpdate && custom && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => setDialog("edit")}
          >
            <Pencil className="size-3.5" /> {ROLE_ADMIN.edit}
          </Button>
        )}
        {canDelete && custom && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || custom.holderCount > 0}
            title={custom.holderCount > 0 ? ROLE_ADMIN.inUse : undefined}
            onClick={() => setDialog("delete")}
          >
            <Trash2 className="size-3.5" /> {ROLE_ADMIN.remove}
          </Button>
        )}
      </div>
      {canDelete && custom && custom.holderCount > 0 && (
        <p className="text-ink-tertiary text-xs">{ROLE_ADMIN.inUse}</p>
      )}
      {canCreate && (
        <CreateRoleDialog
          open={dialog === "create"}
          onOpenChange={close}
          roles={roles}
          onCreated={(role) => {
            setDialog(null);
            onSelect(role.code);
          }}
        />
      )}
      {canUpdate && custom && (
        <EditRoleDialog open={dialog === "edit"} onOpenChange={close} role={custom} />
      )}
      {canDelete && custom && (
        <DeleteRoleDialog
          open={dialog === "delete"}
          onOpenChange={close}
          role={custom}
          onDeleted={() =>
            onSelect(roles.filter((role) => role.code !== custom.code)[0]?.code ?? "")
          }
        />
      )}
    </div>
  );
}
