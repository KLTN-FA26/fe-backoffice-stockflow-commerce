"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { History, Palette, Tag } from "lucide-react";

import { ADMIN_ROUTES, PRODUCT_STATUS } from "@/constants";
import { useAuthStore } from "@/lib/auth/auth-store";
import { usePermissionChecker } from "@/lib/auth/components/Can";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import {
  mediaCapabilities,
  productChangeGate,
  useCategories,
  useProduct,
  useVariants,
} from "@/features/product";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { ProductActionCard } from "./ProductActionCard";
import { ProductAttributesSection } from "./ProductAttributesSection";
import { ProductHistory } from "./ProductHistory";
import { ProductDescriptionSection, ProductGeneralSection } from "./ProductInfoSections";
import { ProductLifecycleCard } from "./ProductLifecycleCard";
import { ProductLifecycleDialogs } from "./ProductLifecycleDialogs";
import { ProductListingSection } from "./ProductListingSection";
import { ProductLoadError } from "./ProductLoadError";
import { ProductOpenReferencesCard } from "./ProductOpenReferencesCard";
import { ProductPrintAreasSection } from "./ProductPrintAreasSection";
import { Section } from "./ProductSection";
import { ProductSideCards } from "./ProductSideCards";
import { ProductVariantsSection } from "./ProductVariantsSection";
import { useProductStatusActions } from "./useProductStatusActions";

/** Trang chi tiết sản phẩm — chỉ ghép các mục cột trái và thẻ cột phải. */
export function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = React.use(params);
  const can = usePermissionChecker();
  const currentUserId = useAuthStore((state) => state.user?.userId);
  const router = useRouter();

  const productQuery = useProduct(productId);
  // URL dùng id kỹ thuật (UUID của BE) — breadcrumb hiện mã sản phẩm như trang chi tiết NCC.
  useBreadcrumbLabel(productId, productQuery.data?.code);
  const variantsQuery = useVariants(productId);
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
    // Giao diện kiểu Vercel như trang danh sách (globals.css `.surface-soft`). Không hiện tiêu đề —
    // breadcrumb topbar đã có mã sản phẩm và link về danh sách; h1 giữ cho screen reader.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{product.name}</h1>

      <ProductLifecycleDialogs
        product={product}
        dialog={status.dialog}
        onClose={status.closeDialog}
        onDeleted={() => router.push(ADMIN_ROUTES.products.list)}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <ProductGeneralSection product={product} categories={categories} />
          <ProductDescriptionSection product={product} />
          {/* Trục biến thể + thuộc tính mô tả — BE PR #114 */}
          <Section title="Thuộc tính & trục biến thể" icon={Palette}>
            <ProductAttributesSection productId={product.productId} status={product.status} />
          </Section>
          <ProductVariantsSection
            productId={product.productId}
            productCode={product.code ?? product.productId}
            productDiscontinued={product.status === PRODUCT_STATUS.DISCONTINUED}
            acceptsChanges={gate.acceptsChanges}
            productApproved={gate.approved}
            query={variantsQuery}
          />
          {/* Thông tin bán trên cửa hàng — BE `GET/PUT /products/{id}/ecommerce` */}
          <Section title="Thông tin cửa hàng (TMĐT)" icon={Tag} defaultOpen={false}>
            <ProductListingSection productId={product.productId} status={product.status} />
          </Section>
          {/* Lịch sử thay đổi — BE `GET /products/{id}/versions` (tải khi mở mục) */}
          <Section title="Lịch sử thay đổi" icon={History} defaultOpen={false}>
            <ProductHistory productId={product.productId} skuById={skuById} />
          </Section>
          <ProductPrintAreasSection product={product} />
        </div>

        <div className="space-y-5">
          {/* Trạng thái + hành động — cùng bố cục thẻ hành động trang chi tiết NCC */}
          <ProductActionCard
            product={product}
            can={can}
            currentUserId={currentUserId}
            isPending={status.isPending}
            onAction={(action) => void status.run(action)}
          />
          <ProductOpenReferencesCard
            productId={product.productId}
            status={product.status}
            can={can}
          />
          <ProductLifecycleCard status={product.status} />
          <ProductSideCards
            productId={product.productId}
            variants={variants}
            media={mediaCapabilities(gate, can)}
          />
        </div>
      </div>
    </div>
  );
}
