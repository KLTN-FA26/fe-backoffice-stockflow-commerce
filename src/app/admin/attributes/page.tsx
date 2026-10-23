import { Suspense } from "react";

import { ATTRIBUTE_PERMISSIONS } from "@/constants/permissions";

import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { AttributeDictionary } from "@/features/product/components/AttributeDictionary";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function AttributesPage() {
  return (
    <PermissionBoundary
      permissions={[ATTRIBUTE_PERMISSIONS.viewPage, ATTRIBUTE_PERMISSIONS.read]}
      variant="list"
    >
      <Suspense fallback={<PageSkeleton variant="list" />}>
        <AttributeDictionary />
      </Suspense>
    </PermissionBoundary>
  );
}
