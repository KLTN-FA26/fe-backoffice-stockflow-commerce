"use client";

import { useState } from "react";

import { INVENTORY_ITEM_PERMISSIONS, PRODUCT_PERMISSIONS, UI_LABELS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { SlideOverPanel } from "@/components/shared/SlideOverPanel";
import { StatusDot } from "@/components/shared/StatusDot";

import { mediaCapabilities } from "../../product-capabilities";
import { VariantBasePrice } from "./VariantBasePrice";
import { VariantFormDialog } from "./VariantFormDialog";
import { VariantInventorySummary } from "./VariantInventorySummary";
import { VariantMediaGallery } from "./VariantMediaGallery";
import { VariantOverview } from "./VariantOverview";

import type { Variant } from "../../variant-schemas";

/**
 * Chi tiết một biến thể: trạng thái, tóm tắt hồ sơ hàng tồn (logistics — sửa ở trang Hồ sơ hàng tồn,
 * BE PR #119), giá bán, ảnh.
 */
export function VariantPanel({
  productId,
  variant,
  productApproved,
  acceptsChanges,
  productDiscontinued,
  open,
  onClose,
}: {
  productId: string;
  variant: Variant | null;
  productApproved: boolean;
  /** Không chờ duyệt, không ngừng kinh doanh: biến thể và ảnh mới sửa được (BE 409). */
  acceptsChanges: boolean;
  /** Sản phẩm đã ngừng kinh doanh: BE `CatalogCommerceService.price` chỉ từ chối trường hợp này (chờ duyệt vẫn đặt giá được). */
  productDiscontinued: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const can = usePermissionChecker();
  // Biến thể: `product-variants:UPDATE`; giá, ảnh: `product-products`; hồ sơ hàng tồn:
  // `inventory-inventory-items`, không theo trạng thái SP (BE PR #119). UI-only — BE re-check.
  const canUpdate = can(PRODUCT_PERMISSIONS.update);
  const [editing, setEditing] = useState(false);
  const obsolete = variant?.status === "OBSOLETE";
  const media = mediaCapabilities({ acceptsChanges, approved: productApproved }, can, obsolete);

  return (
    <SlideOverPanel
      open={open}
      onClose={onClose}
      title={variant?.sku ?? ""}
      monoTitle
      subtitle={variant?.name}
      badge={variant && <StatusDot domain="sku" status={variant.status} size="sm" />}
    >
      {variant && (
        <div className="space-y-6">
          <VariantOverview
            productId={productId}
            variant={variant}
            productApproved={productApproved}
            acceptsChanges={acceptsChanges}
            onEdit={() => setEditing(true)}
          />

          <section>
            <h3 className="text-ink-primary mb-2 text-sm font-semibold">
              {UI_LABELS.inventoryItem.variantSummary.title}
            </h3>
            <VariantInventorySummary
              inventoryItemId={variant.inventoryItemId}
              canRead={can(INVENTORY_ITEM_PERMISSIONS.read)}
            />
          </section>

          <section>
            <h3 className="text-ink-primary mb-2 text-sm font-semibold">Giá bán</h3>
            <VariantBasePrice
              productId={productId}
              sku={variant.sku}
              canEdit={canUpdate && !productDiscontinued}
            />
          </section>

          <section>
            <h3 className="text-ink-primary mb-2 text-sm font-semibold">Hình ảnh</h3>
            <VariantMediaGallery
              productId={productId}
              variantId={variant.variantId}
              canUpload={media.upload}
              canManage={media.manage}
              canPublish={media.publish}
              canWithdraw={media.withdraw}
            />
          </section>
        </div>
      )}

      {variant && (
        <VariantFormDialog
          productId={productId}
          variant={variant}
          open={editing}
          onOpenChange={setEditing}
        />
      )}
    </SlideOverPanel>
  );
}
