"use client";

import { useState } from "react";
import { RotateCw } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { useSkuSuppliers } from "@/lib/references/sku-suppliers";
import { Button } from "@/components/ui/button";

import { purchasingLoadError } from "../../purchasing-errors";
import { useSkuPurchasing } from "../../purchasing-queries";
import { VariantPurchasingForm } from "./VariantPurchasingForm";
import { supplierLookup } from "./VariantPurchasingSupplier";
import { VariantPurchasingView } from "./VariantPurchasingView";

const L = UI_LABELS.skuPurchasing;
const NOTE = "text-ink-tertiary text-xs";

/**
 * Thông tin mua hàng của SKU (BE `GET/PUT /products/{id}/variants/{variantId}/purchasing`,
 * `product-products:READ` / `UPDATE`). Đọc được ở mọi trạng thái sản phẩm / biến thể: BE chỉ chặn GHI
 * khi chờ duyệt / ngừng kinh doanh / biến thể ngừng. Tên NCC mặc định tra qua danh sách NCC của SKU khi
 * có `procurement-supplier-items:READ`. Sửa khi `canEdit` (panel tính từ quyền + trạng thái); đổi NCC mặc
 * định cần thêm quyền đọc danh mục NCC. UI-only — Backend phải re-check mọi quyền. Panel đặt
 * `key={variantId}`: đổi biến thể là dựng lại mục này, form của biến thể trước bị bỏ.
 */
export function VariantPurchasing({
  productId,
  variantId,
  canRead,
  canReadSuppliers,
  canEdit,
  open,
}: {
  productId: string;
  variantId: string;
  canRead: boolean;
  canReadSuppliers: boolean;
  /** `product-products:READ` + `UPDATE`, sản phẩm nhận thay đổi, biến thể chưa ngừng. */
  canEdit: boolean;
  /** Panel đang mở — đóng thì không tải. */
  open: boolean;
}) {
  const query = useSkuPurchasing(productId, variantId, canRead && open);
  const [editing, setEditing] = useState(false);
  const data = query.data;
  const defaultId = data?.defaultSupplierId ?? null;
  // Tra khi có quyền đọc danh mục NCC và cần: có NCC mặc định để hiện, hoặc đang sửa (danh sách chọn)
  const suppliers = useSkuSuppliers(
    data?.sku ?? "",
    canReadSuppliers && open && (defaultId !== null || editing),
  );

  if (!canRead) return <p className={NOTE}>{L.noPermission}</p>;
  if (query.isPending) return <p className={NOTE}>{L.loading}</p>;
  // Chỉ thay cả mục bằng lỗi khi CHƯA có dữ liệu: lần tải lại nền lỗi (vd sau 409) không được gỡ form
  // đang sửa dở hay giấu dữ liệu đã có
  if (data === undefined) {
    const { message, retryable } = purchasingLoadError(query.error);
    return (
      <div className="space-y-2">
        <p role="alert" className="text-danger text-xs">
          {message}
        </p>
        {retryable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RotateCw className="size-3.5" /> {L.retry}
          </Button>
        )}
      </div>
    );
  }

  const lookup = supplierLookup(defaultId, canReadSuppliers, suppliers);
  if (editing) {
    return (
      <VariantPurchasingForm
        productId={productId}
        variantId={variantId}
        latest={data}
        reload={query.refetch}
        lookup={lookup}
        // Chọn NCC chỉ khi có quyền và đã có danh mục (kể cả bản cũ khi tải lại nền lỗi — không đổi ô
        // chọn thành chỉ đọc giữa chừng); chưa có danh mục → giữ nguyên NCC mặc định
        supplierRows={canReadSuppliers ? (suppliers.data ?? null) : null}
        canSave={canEdit}
        onDone={() => setEditing(false)}
      />
    );
  }
  return (
    <VariantPurchasingView
      data={data}
      lookup={lookup}
      onEdit={canEdit ? () => setEditing(true) : undefined}
    />
  );
}
