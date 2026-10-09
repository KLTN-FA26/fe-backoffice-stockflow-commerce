import { PRODUCT_PERMISSIONS } from "@/constants/permissions";

import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { SkuDetail } from "@/features/product/components/SkuDetail";

export default function SkuDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PermissionBoundary permissions={[PRODUCT_PERMISSIONS.viewPage, PRODUCT_PERMISSIONS.read]}>
      <SkuDetail params={params} />
    </PermissionBoundary>
  );
}
