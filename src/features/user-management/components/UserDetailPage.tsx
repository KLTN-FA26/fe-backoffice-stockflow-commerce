"use client";

import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { ADMIN_ROUTES, IDENTITY_PERMISSIONS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { identityErrorMessage } from "@/lib/api/identity-errors";
import { useAuthStore, useCan } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";

import { USER_UI } from "../constants";
import { useUser } from "../queries";
import { userDisplayName } from "../selectors";
import { useReferenceData } from "../use-reference-data";

import { AccountActionsCard } from "./detail/AccountActionsCard";
import { ProfileCard } from "./detail/ProfileCard";
import { RolesCard } from "./detail/RolesCard";
import { WarehousesCard } from "./detail/WarehousesCard";

/** Chi tiết + chỉnh sửa một tài khoản. Cổng route (`usersRead`) nằm ở `app/admin/users/[id]/page.tsx`. */
export function UserDetailPage({ id }: { id: string }) {
  const canRead = useCan(IDENTITY_PERMISSIONS.usersRead);
  const canUpdate = useCan(IDENTITY_PERMISSIONS.usersUpdate);
  const query = useUser(id, { enabled: canRead });
  const refs = useReferenceData(query.data?.warehouseIds);
  // Breadcrumb hiện tên đăng nhập thay vì id kỹ thuật trong URL
  useBreadcrumbLabel(id, query.data?.username);
  const myId = useAuthStore((state) => state.user?.userId ?? null);

  if (query.isPending) return <PageSkeleton variant="detail" />;
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.code === "USER_NOT_FOUND";
    return (
      <EmptyState
        title={notFound ? "Không tìm thấy người dùng" : USER_UI.loadFailed}
        description={identityErrorMessage(query.error)}
        action={
          notFound ? (
            <Button asChild size="sm" variant="outline">
              <Link href={ADMIN_ROUTES.users.list}>Về danh sách</Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
              {USER_UI.retry}
            </Button>
          )
        }
      />
    );
  }

  const user = query.data;
  // UI-only: BE từ chối thao tác lên chính mình bằng OWN_ACCOUNT_NOT_MANAGEABLE (BE PR #72, SCRUM-456)
  const isSelf = myId === user.userId;
  const canEdit = canUpdate && !isSelf;
  const label = userDisplayName(user);

  return (
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{label}</h1>
      {isSelf && (
        <p role="status" className="text-ink-secondary mb-4 text-[0.8125rem]">
          {USER_UI.selfNotice}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-4 xl:col-span-2">
          <ProfileCard user={user} canEdit={canEdit} title={label} />
        </div>
        <RolesCard user={user} canEdit={canEdit} roles={refs.canReadRoles ? refs.roles : null} />
        <WarehousesCard
          user={user}
          canEdit={canEdit}
          items={refs.canReadWarehouses ? refs.warehouseItems : null}
          roles={refs.roles}
        />
        <AccountActionsCard user={user} canEdit={canEdit} accountLabel={label} />
      </div>
    </div>
  );
}
