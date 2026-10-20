"use client";

import { cn } from "cn";

import { countVariantsByStatus } from "@/features/product";

import { PRODUCT_CARD_CLASS } from "./ProductSection";
import { VariantMediaGallery } from "./variants/VariantMediaGallery";

import type { MediaCapabilities, Variant } from "@/features/product";

/** Cột phải: ảnh của biến thể mặc định + tổng quan biến thể theo trạng thái. */
export function ProductSideCards({
  productId,
  variants,
  media,
}: {
  productId: string;
  variants: readonly Variant[];
  /** Gate ảnh theo trạng thái sản phẩm + quyền (`mediaCapabilities`). */
  media: MediaCapabilities;
}) {
  // BE PR #71: ảnh thuộc biến thể — thẻ bên phải xem ảnh của biến thể mặc định.
  const defaultVariant = variants.find((v) => v.defaultVariant) ?? variants[0];
  const variantCounts = countVariantsByStatus(variants);
  return (
    <>
      {/* Hình ảnh — của biến thể mặc định; quản lý trong panel từng biến thể */}
      <section className={PRODUCT_CARD_CLASS}>
        <h2 className="text-ink-primary mb-1 text-[0.9375rem] font-semibold">Hình ảnh</h2>
        <p className="text-ink-tertiary mb-3 text-xs">
          {defaultVariant
            ? `Biến thể mặc định ${defaultVariant.sku}. Tải lên và xuất bản ảnh trong từng biến thể.`
            : "Sản phẩm chưa có biến thể."}
        </p>
        {defaultVariant && (
          <VariantMediaGallery
            productId={productId}
            variantId={defaultVariant.variantId}
            canUpload={media.upload}
            canManage={media.manage}
            canPublish={media.publish}
            canWithdraw={media.withdraw}
            compact
          />
        )}
      </section>

      {/* Quick stats */}
      <section className={PRODUCT_CARD_CLASS}>
        <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">Tổng quan biến thể</h2>
        <div className="space-y-2">
          <StatRow label="Tổng biến thể" value={variants.length} />
          <StatRow label="Nháp" value={variantCounts.DRAFT} />
          <StatRow label="Đang dùng" value={variantCounts.ACTIVE} tone="text-positive" />
          <StatRow label="Tạm chặn" value={variantCounts.BLOCKED} tone="text-warning" />
          <StatRow label="Ngừng dùng" value={variantCounts.OBSOLETE} tone="text-danger" />
        </div>
      </section>
    </>
  );
}

function StatRow({
  label,
  value,
  tone = "text-ink-primary",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="flex justify-between text-[0.8125rem]">
      <span className="text-ink-secondary">{label}</span>
      <span className={cn("font-[family-name:var(--font-mono)] font-medium", tone)}>{value}</span>
    </div>
  );
}
