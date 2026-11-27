"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";
import { IDENTITY_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";
import { useRoleOptions } from "@/lib/references/role-options";

import { USER_UI } from "../constants";

import { CreateUserDialog } from "./CreateUserDialog";
import { TemporaryPasswordDialog } from "./TemporaryPasswordDialog";
import { buildUserColumns } from "./user-list/columns";
import { UserListBody } from "./user-list/UserListBody";
import { UserListToolbar } from "./user-list/UserListToolbar";
import { useUserListState } from "./user-list/useUserListState";

import type { RoleOption } from "@/lib/references/role-options";
import type { CreatedUser } from "../types";

const EMPTY_ROLES: RoleOption[] = [];

/**
 * Danh sách tài khoản nhân viên (kiểu Vercel `.surface-soft`: không title hiển thị — tên trang là
 * breadcrumb). Cổng route (`usersRead`) nằm ở `app/admin/users/page.tsx`.
 */
export function UserListPage() {
  const canRead = useCan(IDENTITY_PERMISSIONS.usersRead);
  const canCreate = useCan(IDENTITY_PERMISSIONS.usersCreate);
  const s = useUserListState(canRead);
  // Chỉ tải danh mục vai trò (nhãn + bộ lọc); tên kho đã có sẵn trên từng dòng (BE #286).
  const canReadRoles = useCan(IDENTITY_PERMISSIONS.rolesRead);
  const roles = useRoleOptions(canReadRoles).data ?? EMPTY_ROLES;
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedUser | null>(null);

  const columns = useMemo(() => buildUserColumns({ roles }), [roles]);
  const createButton = canCreate ? (
    <Button
      size="sm"
      className={`${TOOLBAR_ACTION_CLASS} bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse`}
      onClick={() => setCreating(true)}
    >
      <Plus className="size-3.5" /> {USER_UI.createButton}
    </Button>
  ) : undefined;

  return (
    <div className="surface-soft">
      <h1 className="sr-only">{USER_UI.title}</h1>
      {canRead && (
        <UserListToolbar s={s} roles={canReadRoles ? roles : null} actions={createButton} />
      )}
      <UserListBody s={s} columns={columns} createAction={createButton} />
      {canCreate && (
        <CreateUserDialog
          open={creating}
          onOpenChange={setCreating}
          onCreated={(result) => {
            setCreating(false);
            if (result.temporaryPassword) setCreated(result);
          }}
        />
      )}
      <TemporaryPasswordDialog
        password={created?.temporaryPassword ?? null}
        accountLabel={created?.user.username ?? ""}
        reason="created"
        onClose={() => setCreated(null)}
      />
    </div>
  );
}
