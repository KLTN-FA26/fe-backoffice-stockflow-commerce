"use client";

import { useState } from "react";

import { PRODUCT_REJECT_LABELS } from "@/constants";
import { productTransitionErrorMessage, useTransitionProduct } from "@/features/product";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import type { Product } from "@/features/product";

const L = PRODUCT_REJECT_LABELS;

/**
 * Từ chối duyệt (BE `POST /products/{id}/rejection`, `RejectProductRequest.reason` @NotBlank, cột
 * TEXT nên không giới hạn độ dài): lý do bắt buộc ngay trong hộp thoại, thay `window.prompt`. Lỗi hiện
 * trong hộp thoại và giữ lý do đã nhập; 409 trạng thái / version cũ thì mutation tự tải lại chi tiết.
 * UI-only — Backend phải re-check quyền product-products:APPROVE và trạng thái Chờ duyệt.
 */
export function ProductRejectDialog({
  product,
  open,
  onClose,
}: {
  product: Product;
  open: boolean;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const reject = useTransitionProduct();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (next || reject.isPending) return;
        setError(null);
        onClose();
      }}
      title={L.title}
      description={L.description}
      confirmLabel={L.confirm}
      requireReason
      reasonLabel={L.reasonLabel}
      closeOnConfirm={false}
      loading={reject.isPending}
      error={open ? error : null}
      onConfirm={(reason) => {
        const text = reason?.trim();
        if (!text) return;
        setError(null);
        reject.mutate(
          { id: product.productId, action: "reject", reason: text },
          { onSuccess: onClose, onError: (e) => setError(productTransitionErrorMessage(e)) },
        );
      }}
    />
  );
}
