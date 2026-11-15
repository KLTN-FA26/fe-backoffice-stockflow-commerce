"use client";

import { ADMIN_ROUTES, PRODUCT_PERMISSIONS } from "@/constants";
import { PRINT_CONFIG_PAGE_LABELS as TEXT } from "@/constants/labels-print-config";
import { PRINT_CONFIG_SEGMENT } from "@/constants/routes";
import { usePermissionChecker } from "@/lib/auth/components/Can";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { productChangeGate, useProduct, useVariants } from "@/features/product";
import { PrintConfigSection } from "@/features/product-design";
import { BackLink } from "@/components/shared/BackLink";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";

import { VariantPrintConfigState } from "./VariantPrintConfigStates";

/**
 * Trang "Cấu hình in" của một biến thể (module 12): chỗ ghép `features/product` (sản phẩm, biến thể, gate thay đổi)
 * với `features/product-design` (màn cấu hình in). Hai feature không import chéo nhau (feature-architecture.md), nên
 * component client này — như `OrderDetailWithLoadEstimate` — là nơi duy nhất biết cả hai; `can` là hàm nên không
 * truyền được từ Server Component của `page.tsx`. Chỉ sản phẩm tuỳ chỉnh có cấu hình in (BE 409
 * PRODUCT_NOT_CUSTOMIZABLE khi ghi). Đo file .glb nằm trong section và chỉ tải khi cần — trang không import `model3d`.
 */
export function VariantPrintConfig({
  productId,
  variantId,
}: {
  productId: string;
  variantId: string;
}) {
  const can = usePermissionChecker();
  const productQuery = useProduct(productId);
  const variantsQuery = useVariants(productId);
  const product = productQuery.data ?? null;
  const variant = variantsQuery.data?.find((v) => v.variantId === variantId) ?? null;

  // Breadcrumb của topbar: đoạn cuối URL là `print-config`, nhãn lấy theo đoạn đó
  useBreadcrumbLabel(PRINT_CONFIG_SEGMENT, TEXT.pageTitle);

  if (productQuery.isLoading || variantsQuery.isLoading) return <PageSkeleton variant="detail" />;
  if (!product) {
    return (
      <VariantPrintConfigState
        kind="failed"
        error={productQuery.error}
        onRetry={() => void productQuery.refetch()}
      />
    );
  }
  if (variantsQuery.isError) {
    return (
      <VariantPrintConfigState
        kind="failed"
        error={variantsQuery.error}
        onRetry={() => void variantsQuery.refetch()}
      />
    );
  }
  if (!variant) return <VariantPrintConfigState kind="variant-missing" />;

  // Cùng điều kiện panel biến thể dùng cho thông tin mua hàng: sản phẩm không chờ duyệt / ngừng kinh doanh
  // (BE `Product.acceptsChanges`) và biến thể chưa ngừng dùng. UI-only — BE re-check (409 CONFLICT).
  // Lý do chỉ đọc theo thứ tự: quyền, rồi sản phẩm, rồi biến thể (section hiện đúng một câu).
  const readOnlyReason = !can(PRODUCT_PERMISSIONS.update)
    ? "permission"
    : !productChangeGate(product.status).acceptsChanges
      ? "product"
      : variant.status === "OBSOLETE"
        ? "variant"
        : undefined;
  const writable = readOnlyReason === undefined;

  return (
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{`${TEXT.pageTitle} — ${variant.sku}`}</h1>
      <div className="max-w-4xl space-y-5">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-ink-tertiary text-xs">{`${TEXT.variantHeading} · ${product.name}`}</p>
              <p className="flex items-center gap-2">
                <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.9375rem] font-semibold">
                  {variant.sku}
                </span>
                <StatusDot domain="sku" status={variant.status} size="sm" />
              </p>
              <p className="text-ink-secondary text-[0.8125rem]">{variant.name}</p>
            </div>
            <BackLink href={ADMIN_ROUTES.products.detail(productId)} label={TEXT.backToProduct} />
          </div>
        </Card>

        {product.type === "Customizable" ? (
          <Card>
            <PrintConfigSection
              productId={productId}
              variantId={variantId}
              can={can}
              writable={writable}
              readOnlyReason={readOnlyReason}
            />
          </Card>
        ) : (
          <EmptyState
            title={TEXT.notCustomizable.title}
            description={TEXT.notCustomizable.description}
          />
        )}
      </div>
    </div>
  );
}
