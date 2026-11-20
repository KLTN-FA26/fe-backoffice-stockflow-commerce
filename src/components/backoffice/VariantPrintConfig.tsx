"use client";

import Link from "next/link";

import {
  ADMIN_ROUTES,
  CUSTOMIZATION_TEMPLATE_PERMISSIONS,
  PRODUCT_PERMISSIONS,
  PRODUCT_STATUS,
} from "@/constants";
import {
  PRINT_CONFIG_PAGE_LABELS as TEXT,
  PRINT_CONFIG_SCREEN_LABELS,
} from "@/constants/labels-print-config";
import { PRINT_CONFIG_SEGMENT } from "@/constants/routes";
import { usePermissionChecker } from "@/lib/auth/components/Can";
import { useMyPermissions } from "@/lib/auth/me-permissions";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { isCartonCandidate, useProduct, useSkuUnits, useVariants } from "@/features/product";
import { PrintConfigSection } from "@/features/product-design";
import { Alert } from "@/components/shared/Alert";
import { DETAIL_CARD_CLASS } from "@/components/shared/DetailSection";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { VariantPrintConfigGeneral } from "./VariantPrintConfigGeneral";
import { VariantPrintConfigState } from "./VariantPrintConfigStates";

/**
 * Trang "Cấu hình in" của một biến thể (module 12): chỗ ghép `features/product` (sản phẩm, biến thể, gate thay đổi)
 * với `features/product-design` (màn cấu hình in). Hai feature không import chéo nhau (feature-architecture.md), nên
 * component client này — như `OrderDetailWithLoadEstimate` — là nơi duy nhất biết cả hai; `can` là hàm nên không
 * truyền được từ Server Component của `page.tsx`. Chỉ sản phẩm tuỳ chỉnh có cấu hình in (BE 409
 * PRODUCT_NOT_CUSTOMIZABLE khi ghi). Đo file .glb nằm trong section và chỉ tải khi cần — trang không import `model3d`.
 * Bố cục trang chi tiết (như `ProductDetail`): không tiêu đề, không "Quay lại" — tên biến thể và link về sản phẩm nằm ở
 * "Thông tin chung" (các dòng do trang dựng, section thêm trạng thái cấu hình in); breadcrumb có đường quay lại.
 */
export function VariantPrintConfig({
  productId,
  variantId,
}: {
  productId: string;
  variantId: string;
}) {
  const can = usePermissionChecker();
  const permissions = useMyPermissions();
  const productQuery = useProduct(productId);
  const variantsQuery = useVariants(productId);
  const product = productQuery.data ?? null;
  const variant = variantsQuery.data?.find((v) => v.variantId === variantId) ?? null;
  // Preflight `CARTON_SPEC_MISSING` hỏi đúng câu "có đơn vị đóng gói nào không" (`isCartonCandidate`). Chưa tải /
  // thiếu quyền đọc thì không báo gì: cảnh báo chỉ hiện khi chắc chắn biến thể chưa có thùng.
  const units = useSkuUnits(
    productId,
    variantId,
    can(PRODUCT_PERMISSIONS.read) && product?.type === "Customizable",
  );
  const cartonMissing = units.data !== undefined && !units.data.some(isCartonCandidate);

  // Breadcrumb của topbar: đoạn cuối URL là `print-config`, nhãn lấy theo đoạn đó
  useBreadcrumbLabel(PRINT_CONFIG_SEGMENT, TEXT.pageTitle);

  if (productQuery.isLoading || variantsQuery.isLoading || permissions.isPending)
    return <PageSkeleton variant="detail" />;
  // A failed permission load is not "no access": say so, with a retry, instead of hiding the page behind a false refusal.
  if (permissions.isError) {
    return (
      <VariantPrintConfigState
        kind="permissions-failed"
        error={permissions.error}
        onRetry={() => void permissions.refetch()}
      />
    );
  }
  // Product access is not enough: the BE guards templates with their own resource (a sales staff has the product's
  // READ and not this one), and without READ every call answers 403. Say so instead of an empty screen.
  if (!can(CUSTOMIZATION_TEMPLATE_PERMISSIONS.read))
    return <VariantPrintConfigState kind="no-access" />;
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

  // Đúng điều kiện BE `PrintConfigService.requireWritable` (khác `acceptsChanges` của thông tin mua hàng): chỉ sản phẩm
  // ngừng kinh doanh và biến thể ngừng dùng chặn ghi; sản phẩm đang chờ duyệt vẫn sửa được cấu hình in. UI-only — BE
  // re-check (409 CONFLICT). Lý do chỉ đọc theo thứ tự: quyền, rồi sản phẩm, rồi biến thể (section hiện đúng một câu).
  const readOnlyReason = !can(CUSTOMIZATION_TEMPLATE_PERMISSIONS.update)
    ? "permission"
    : product.status === PRODUCT_STATUS.DISCONTINUED
      ? "product"
      : variant.status === "OBSOLETE"
        ? "variant"
        : undefined;
  const writable = readOnlyReason === undefined;

  const general = <VariantPrintConfigGeneral product={product} variant={variant} />;

  return (
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{`${TEXT.pageTitle} — ${variant.sku}`}</h1>
      {product.type === "Customizable" ? (
        <div className="space-y-5">
          {cartonMissing && (
            <Alert tone="warning" title={TEXT.cartonMissing.title}>
              {TEXT.cartonMissing.description}{" "}
              <Link
                href={ADMIN_ROUTES.products.detail(productId)}
                className="text-accent underline-offset-2 hover:underline"
              >
                {TEXT.cartonMissing.link}
              </Link>
            </Alert>
          )}
          <PrintConfigSection
            productId={productId}
            variantId={variantId}
            can={can}
            writable={writable}
            readOnlyReason={readOnlyReason}
            general={general}
          />
        </div>
      ) : (
        <div className="space-y-5">
          <section
            aria-label={PRINT_CONFIG_SCREEN_LABELS.cards.header}
            className={DETAIL_CARD_CLASS}
          >
            {general}
          </section>
          <EmptyState
            title={TEXT.notCustomizable.title}
            description={TEXT.notCustomizable.description}
          />
        </div>
      )}
    </div>
  );
}
