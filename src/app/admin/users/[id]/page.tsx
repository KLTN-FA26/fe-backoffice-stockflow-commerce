import { IDENTITY_PERMISSIONS } from "@/constants/permissions";

import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { UserDetailPage } from "@/features/user-management/components/UserDetailPage";

export default async function UserDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PermissionBoundary permissions={[IDENTITY_PERMISSIONS.usersRead]}>
      <UserDetailPage id={id} />
    </PermissionBoundary>
  );
}
