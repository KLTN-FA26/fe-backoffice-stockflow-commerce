import { Suspense } from "react";

import { PRODUCT_PERMISSIONS } from "@/constants/permissions";

import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";

import { TaxonomyManager } from "@/features/product/components/taxonomy/TaxonomyManager";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Thương hiệu & danh mục — BE `ProductTaxonomyController` gate mọi endpoint bằng product-products. */
export default function TaxonomyPage() {
  return (
    <PermissionBoundary
      permissions={[PRODUCT_PERMISSIONS.viewPage, PRODUCT_PERMISSIONS.read]}
      variant="list"
    >
      <Suspense fallback={<PageSkeleton variant="list" />}>
        <TaxonomyManager />
      </Suspense>
    </PermissionBoundary>
  );
}
