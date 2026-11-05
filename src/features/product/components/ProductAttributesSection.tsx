"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { PRODUCT_PERMISSIONS, PRODUCT_STATUS, VARIANT_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { Button } from "@/components/ui/button";

import { attributeErrorMessage } from "../attribute-errors";
import { useProductAttributes } from "../variant-queries";
import { AxesEditorDialog } from "./AxesEditorDialog";
import { DescriptiveEditorDialog } from "./DescriptiveEditorDialog";

import type { ProductDescriptive } from "../axes-schemas";
import type { ProductStatus } from "../types";

function descriptiveValue(d: ProductDescriptive): string {
  if (d.values.length > 0) return d.values.map((v) => v.label).join(", ");
  if (d.text) return d.text;
  if (d.number != null) return `${d.number}${d.unit ? ` ${d.unit}` : ""}`;
  if (d.bool != null) return d.bool ? "Có" : "Không";
  return "—";
}

/**
 * Trục biến thể (màu, cỡ…) và thuộc tính mô tả của sản phẩm — BE `GET /products/{id}/attributes`.
 * Trục là cấu trúc biến thể (quyền `product-variants`), thuộc tính mô tả là nội dung sản phẩm
 * (`product-products`). Sản phẩm chờ duyệt hoặc đã ngừng kinh doanh không nhận thay đổi (BE
 * `Product.acceptsChanges`); backend phải re-check.
 */
export function ProductAttributesSection({
  productId,
  status,
}: {
  productId: string;
  status: ProductStatus;
}) {
  const can = usePermissionChecker();
  const query = useProductAttributes(productId);
  const [editing, setEditing] = useState<"axes" | "descriptives" | null>(null);
  const acceptsChanges =
    status !== PRODUCT_STATUS.PENDING_APPROVAL && status !== PRODUCT_STATUS.DISCONTINUED;
  const canEditAxes = acceptsChanges && can(VARIANT_PERMISSIONS.update);
  const canEditDescriptives = acceptsChanges && can(PRODUCT_PERMISSIONS.update);

  if (query.isLoading)
    return <p className="text-ink-tertiary text-[0.8125rem]">Đang tải thuộc tính…</p>;
  if (query.isError || !query.data) {
    return (
      <p role="alert" className="text-danger text-[0.8125rem]">
        {attributeErrorMessage(query.error, "load")}
      </p>
    );
  }
  const { axes, descriptives } = query.data;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-ink-primary text-sm font-semibold">Trục biến thể</h3>
          {canEditAxes && (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing("axes")}>
              <Pencil className="size-3.5" /> Sửa trục
            </Button>
          )}
        </div>
        {axes.length === 0 ? (
          <p className="text-ink-tertiary text-[0.8125rem]">
            Chưa có trục — sản phẩm có biến thể nhập SKU tay. Thêm trục để sinh biến thể theo tổ
            hợp.
          </p>
        ) : (
          axes.map((axis) => (
            <div key={axis.attributeId}>
              <div className="text-ink-tertiary mb-1.5 text-xs font-medium">
                {axis.name} <span className="opacity-60">({axis.code})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {axis.options.map((option) => (
                  <span
                    key={option.valueId}
                    className="border-border-default bg-bg-subtle text-ink-secondary inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                    title={option.usedByVariant ? "Đang có biến thể dùng" : undefined}
                  >
                    {option.hexColor && (
                      <span
                        className="border-border-default size-3 rounded-full border"
                        style={{ backgroundColor: option.hexColor }}
                      />
                    )}
                    {option.label}
                    {!option.active && <span className="text-ink-tertiary">(đã vô hiệu)</span>}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-ink-primary text-sm font-semibold">Thuộc tính mô tả</h3>
          {canEditDescriptives && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing("descriptives")}
            >
              <Pencil className="size-3.5" /> Sửa thuộc tính
            </Button>
          )}
        </div>
        {descriptives.length === 0 ? (
          <p className="text-ink-tertiary text-[0.8125rem]">Chưa có thuộc tính mô tả.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.8125rem]">
            {descriptives.map((d) => (
              <div key={d.attributeId}>
                <dt className="text-ink-tertiary text-xs">{d.name}</dt>
                <dd>{descriptiveValue(d)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <AxesEditorDialog
        productId={productId}
        isDraft={status === PRODUCT_STATUS.DRAFT}
        open={editing === "axes"}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <DescriptiveEditorDialog
        productId={productId}
        open={editing === "descriptives"}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </div>
  );
}
