"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { PRODUCT_PERMISSIONS, PRODUCT_STATUS, VARIANT_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { Button } from "@/components/ui/button";

import { attributeErrorMessage } from "../attribute-errors";
import { useProductAttributes } from "../variant-queries";
import { AxesEditorDialog } from "./AxesEditorDialog";
import { AxesTable } from "./ProductAxesTable";
import { DescriptiveEditorDialog } from "./DescriptiveEditorDialog";
import { DetailPanel, Fact, FactGrid } from "@/components/shared/DetailPanel";

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
  canRead = true,
}: {
  productId: string;
  status: ProductStatus;
  /** `product-variants:READ` — BE gate `GET /products/{id}/attributes`; thiếu thì không gọi. */
  canRead?: boolean;
}) {
  const can = usePermissionChecker();
  const query = useProductAttributes(productId, canRead);
  const [editing, setEditing] = useState<"axes" | "descriptives" | null>(null);
  const acceptsChanges =
    status !== PRODUCT_STATUS.PENDING_APPROVAL && status !== PRODUCT_STATUS.DISCONTINUED;
  const canEditAxes = acceptsChanges && can(VARIANT_PERMISSIONS.update);
  const canEditDescriptives = acceptsChanges && can(PRODUCT_PERMISSIONS.update);

  if (!canRead) {
    return (
      <p className="text-ink-tertiary text-[0.8125rem]">
        Bạn không có quyền xem trục và thuộc tính của sản phẩm.
      </p>
    );
  }
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
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <DetailPanel
        title="Trục biến thể"
        count={axes.length}
        description="Biến thể sinh ra từ tổ hợp giá trị của các trục."
        flush
        actions={
          canEditAxes && (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing("axes")}>
              <Pencil className="size-3.5" aria-hidden /> Sửa trục
            </Button>
          )
        }
      >
        {axes.length === 0 ? (
          <p className="text-ink-tertiary p-4 text-[0.8125rem]">
            Chưa có trục — sản phẩm có biến thể nhập SKU tay. Thêm trục để sinh biến thể theo tổ
            hợp.
          </p>
        ) : (
          <AxesTable axes={axes} />
        )}
      </DetailPanel>

      <DetailPanel
        title="Thuộc tính mô tả"
        count={descriptives.length}
        description="Thông tin mô tả chung cho mọi biến thể của sản phẩm."
        actions={
          canEditDescriptives && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing("descriptives")}
            >
              <Pencil className="size-3.5" aria-hidden /> Sửa thuộc tính
            </Button>
          )
        }
      >
        {descriptives.length === 0 ? (
          <p className="text-ink-tertiary text-[0.8125rem]">Chưa có thuộc tính mô tả.</p>
        ) : (
          <FactGrid columns={3}>
            {descriptives.map((d) => (
              <Fact key={d.attributeId} label={d.name}>
                {descriptiveValue(d)}
              </Fact>
            ))}
          </FactGrid>
        )}
      </DetailPanel>

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
