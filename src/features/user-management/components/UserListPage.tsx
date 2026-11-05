"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";
import { IDENTITY_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";

import { USER_UI } from "../constants";
import { useReferenceData } from "../use-reference-data";

import { CreateUserDialog } from "./CreateUserDialog";
import { TemporaryPasswordDialog } from "./TemporaryPasswordDialog";
import { buildUserColumns } from "./user-list/columns";
import { UserListBody } from "./user-list/UserListBody";
import { UserListToolbar } from "./user-list/UserListToolbar";
import { useUserListState } from "./user-list/useUserListState";

import type { CreatedUser } from "../types";

/**
 * Danh sách tài khoản nhân viên (kiểu Vercel `.surface-soft`: không title hiển thị — tên trang là
 * breadcrumb). Cổng route (`usersRead`) nằm ở `app/admin/users/page.tsx`.
 */
export function UserListPage() {
  const canRead = useCan(IDENTITY_PERMISSIONS.usersRead);
  const canCreate = useCan(IDENTITY_PERMISSIONS.usersCreate);
  const s = useUserListState(canRead);
  const refs = useReferenceData();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedUser | null>(null);

  const warehouseNames = useMemo(
    () => new Map(refs.warehouses.map((warehouse) => [warehouse.warehouseId, warehouse.name])),
    [refs.warehouses],
  );
  const columns = useMemo(
    () => buildUserColumns({ roles: refs.roles, warehouseNames }),
    [refs.roles, warehouseNames],
  );
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
        <UserListToolbar
          s={s}
          roles={refs.canReadRoles ? refs.roles : null}
          actions={createButton}
        />
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
