"use client";

import { CUSTOMER_PRICE_UI_LABELS } from "@/constants";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import type { ExistingPriceRef } from "./useCustomerPriceEditor";

const F = CUSTOMER_PRICE_UI_LABELS.form;

/**
 * Hỏi trước khi bỏ bản nháp tạo mới để mở bảng giá đã có (sau 409 CONFLICT): nói rõ bản nháp sẽ mất và
 * SKU nào sẽ được mở. "Tiếp tục sửa" chỉ đóng hộp hỏi — form tạo mới, bản nháp và lỗi giữ nguyên.
 */
export function OpenExistingConfirm({
  existing,
  onKeepEditing,
  onConfirm,
}: {
  existing: ExistingPriceRef | null;
  onKeepEditing: () => void;
  onConfirm: (existing: ExistingPriceRef) => void;
}) {
  const sku = existing?.sku ?? "";
  return (
    <ConfirmDialog
      open={existing !== null}
      onOpenChange={(open) => !open && onKeepEditing()}
      title={F.openExistingTitle(sku)}
      description={F.openExistingDescription(sku)}
      confirmLabel={F.openExistingConfirm}
      cancelLabel={F.keepEditing}
      variant="danger"
      onConfirm={() => existing && onConfirm(existing)}
    />
  );
}
