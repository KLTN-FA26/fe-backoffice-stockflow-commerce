"use client";

import { useState } from "react";

import {
  ADMIN_ROUTES,
  CUSTOMIZATION_TEMPLATE_PERMISSIONS,
  INVENTORY_ITEM_PERMISSIONS,
  PRODUCT_PERMISSIONS,
  UI_LABELS,
  VARIANT_PERMISSIONS,
} from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { SlideOverPanel } from "@/components/shared/SlideOverPanel";
import { StatusDot } from "@/components/shared/StatusDot";

import { mediaCapabilities } from "../../product-capabilities";
import { VariantCartonSpec } from "./VariantCartonSpec";
import { VariantDescription } from "./VariantDescription";
import { VariantFormDialog } from "./VariantFormDialog";
import { VariantMediaGallery } from "./VariantMediaGallery";
import { VariantOverview } from "./VariantOverview";
import { VariantPrintConfigLink } from "./VariantPrintConfigLink";

import { isCustomerOwnedSku } from "../../variant-schemas";

import type { Variant } from "../../variant-schemas";

/**
 * Chi tiết một biến thể (quy cách): trạng thái, logistics & quy cách thùng (đơn vị tính của SKU), ảnh, cấu
 * hình in. Quy cách không có giá và không có thông tin mua hàng (docs 01 §1 "Sản phẩm, quy cách và SKU
 * riêng"; BE đã bỏ `.../skus/{sku}/base-price` và `.../variants/{id}/purchasing`).
 */
export function VariantPanel({
  productId,
  variant,
  productApproved,
  acceptsChanges,
  customizable,
  open,
  onClose,
}: {
  productId: string;
  variant: Variant | null;
  productApproved: boolean;
  /** Không chờ duyệt, không ngừng kinh doanh: biến thể và ảnh mới sửa được (BE 409). */
  acceptsChanges: boolean;
  /** Sản phẩm tuỳ chỉnh / in ấn (`kind` CUSTOMIZABLE): chỉ khi đó biến thể có cấu hình in. */
  customizable: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const can = usePermissionChecker();
  // Biến thể: `product-variants:UPDATE`; đơn vị tính / thùng, ảnh: `product-products`; logistics của hồ
  // sơ hàng tồn: `inventory-inventory-items`. UI-only — BE re-check.
  const canUpdate = can(PRODUCT_PERMISSIONS.update);
  const [editing, setEditing] = useState(false);
  const obsolete = variant?.status === "OBSOLETE";
  const media = mediaCapabilities({ acceptsChanges, approved: productApproved }, can, obsolete);
  // SKU riêng của khách: không có cấu hình in riêng (docs 01 §4.10, BR-21 — chỉ quy cách)
  const ownedSku = variant !== null && isCustomerOwnedSku(variant);

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
          {ownedSku && (
            <p className="text-ink-tertiary text-xs">
              {UI_LABELS.product.variants.customerSkuHint}
            </p>
          )}
          <VariantOverview
            productId={productId}
            variant={variant}
            productApproved={productApproved}
            acceptsChanges={acceptsChanges}
            onEdit={() => setEditing(true)}
          />

          <section>
            <h3 className="text-ink-primary mb-2 text-sm font-semibold">
              {UI_LABELS.cartonSpec.title}
            </h3>
            {/* `key`: đổi biến thể là một mục mới — dialog của biến thể trước không giữ lại */}
            <VariantCartonSpec
              key={variant.variantId}
              productId={productId}
              variantId={variant.variantId}
              inventoryItemId={variant.inventoryItemId}
              canRead={can(PRODUCT_PERMISSIONS.read)}
              // BE `SkuUnitService.editableSku`: 409 khi sản phẩm chờ duyệt / ngừng kinh doanh, biến thể ngừng
              canEdit={can(PRODUCT_PERMISSIONS.read) && canUpdate && acceptsChanges && !obsolete}
              canOpenInventoryItem={can(INVENTORY_ITEM_PERMISSIONS.read)}
              open={open}
            />
          </section>

          <section>
            <h3 className="text-ink-primary mb-2 text-sm font-semibold">Mô tả biến thể</h3>
            {/* `key`: đổi biến thể thì bỏ bản nháp của biến thể trước */}
            <VariantDescription
              key={variant.variantId}
              productId={productId}
              variant={variant}
              // BE `ProductVariantService.describe`: `product-variants:UPDATE`, sản phẩm nhận thay đổi
              canEdit={can(VARIANT_PERMISSIONS.update) && acceptsChanges}
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

          {customizable && !ownedSku && can(CUSTOMIZATION_TEMPLATE_PERMISSIONS.read) && (
            <section>
              <VariantPrintConfigLink
                href={ADMIN_ROUTES.products.printConfig(productId, variant.variantId)}
              />
            </section>
          )}
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
