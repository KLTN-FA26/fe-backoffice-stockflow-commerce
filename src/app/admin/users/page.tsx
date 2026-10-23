import { Suspense } from "react";

import { IDENTITY_PERMISSIONS } from "@/constants/permissions";

import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { UserListPage } from "@/features/user-management/components/UserListPage";

export default function UsersPage() {
  return (
    <PermissionBoundary permissions={[IDENTITY_PERMISSIONS.usersRead]} variant="list">
      <Suspense fallback={<PageSkeleton variant="list" />}>
        <UserListPage />
      </Suspense>
    </PermissionBoundary>
  );
}
