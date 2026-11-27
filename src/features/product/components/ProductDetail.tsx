"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import {
  ADMIN_ROUTES,
  PRODUCT_PERMISSIONS,
  PRODUCT_STATUS,
  UI_LABELS,
  VARIANT_PERMISSIONS,
} from "@/constants";
import { useAuthStore } from "@/lib/auth/auth-store";
import { usePermissionChecker } from "@/lib/auth/components/Can";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { productChangeGate, useCategories, useProduct, useVariants } from "@/features/product";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { ProductDetailTabs } from "./ProductDetailTabs";
import { ProductDuplicateList } from "./ProductDuplicateWarning";
import { ProductLifecycleDialogs } from "./ProductLifecycleDialogs";
import { ProductLoadError } from "./ProductLoadError";
import { ProductObjectHeader } from "./ProductObjectHeader";
import { ProductOverviewPanel } from "./ProductOverviewPanel";
import { ProductVariantsSection } from "./ProductVariantsSection";
import { useProductStatusActions } from "./useProductStatusActions";

/** Trang chi tiết sản phẩm — ghép header, khung hồ sơ, bảng biến thể và các tab; logic nằm ở từng mục. */
export function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = React.use(params);
  const can = usePermissionChecker();
  const currentUserId = useAuthStore((state) => state.user?.userId);
  const router = useRouter();

  const productQuery = useProduct(productId);
  // URL dùng id kỹ thuật (UUID của BE) — breadcrumb hiện mã sản phẩm như trang chi tiết NCC.
  useBreadcrumbLabel(productId, productQuery.data?.code);
  // BE: GET biến thể / trục cần `product-variants:READ` — thiếu thì không gọi, mục báo không có quyền
  const canReadVariants = can(VARIANT_PERMISSIONS.read);
  const variantsQuery = useVariants(productId, canReadVariants);
  const categoriesQuery = useCategories({});
  const variants = useMemo(() => variantsQuery.data ?? [], [variantsQuery.data]);
  // variantId → SKU cho mục Lịch sử: chỉ dựng lại khi danh sách biến thể đổi, không mỗi lần render.
  const skuById = useMemo(() => new Map(variants.map((v) => [v.variantId, v.sku])), [variants]);
  const categories = categoriesQuery.data?.items ?? [];
  const product = productQuery.data ?? null;
  const status = useProductStatusActions(product);

  if (productQuery.isLoading || categoriesQuery.isLoading) {
    return <PageSkeleton variant="detail" />;
  }
  if (!product) {
    return (
      <ProductLoadError error={productQuery.error} onRetry={() => void productQuery.refetch()} />
    );
  }

  // BE `Product.acceptsChanges` / `ProductMediaService` — gate ở product-capabilities.ts.
  const gate = productChangeGate(product.status);

  return (
    // Object page ERP: header đối tượng → khung hồ sơ (vòng đời, thông số, mô tả) → bảng biến thể → tab
    // cho các nhóm ít dùng. Nền `.surface-soft` như trang danh sách.
    <div className="surface-soft surface-compact">
      <ProductLifecycleDialogs
        product={product}
        dialog={status.dialog}
        onClose={status.closeDialog}
        onDeleted={() => router.push(ADMIN_ROUTES.products.list)}
      />

      <ProductObjectHeader
        product={product}
        can={can}
        currentUserId={currentUserId}
        isPending={status.isPending}
        pendingAction={status.pendingAction}
        onAction={(action) => void status.run(action)}
      />
      {/* BE `ProductResponse.possibleDuplicates` (GET một sản phẩm) — cảnh báo, không chặn (docs 01 BR-16) */}
      <ProductDuplicateList matches={product.possibleDuplicates ?? []} />
      <ProductOverviewPanel
        product={product}
        categories={categories}
        variants={variants}
        actions={
          // UI-only — BE re-check quyền UPDATE và trạng thái Nháp (`Product.updateDetails`)
          can(PRODUCT_PERMISSIONS.update) && product.status === PRODUCT_STATUS.DRAFT ? (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href={ADMIN_ROUTES.products.edit(product.productId)}>
                <Pencil className="size-3.5" aria-hidden />
                {UI_LABELS.product.actionCard.edit}
              </Link>
            </Button>
          ) : undefined
        }
      />
      {/* Biến thể — dữ liệu xem / thao tác nhiều nhất nên nằm thẳng trên trang, không giấu vào tab */}
      <div className="mb-6">
        <ProductVariantsSection
          productId={product.productId}
          productCode={product.code ?? product.productId}
          acceptsChanges={gate.acceptsChanges}
          productApproved={gate.approved}
          customizable={product.type === "Customizable"}
          canRead={canReadVariants}
          query={variantsQuery}
        />
      </div>
      <ProductDetailTabs
        product={product}
        skuById={skuById}
        can={can}
        canReadVariants={canReadVariants}
      />
    </div>
  );
}
