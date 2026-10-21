"use client";

import { UI_LABELS } from "@/constants";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import type { CreatePoWizard } from "./useCreateForm";

const C = UI_LABELS.purchaseOrder.catalog;

/**
 * Hỏi trước khi đổi NCC khi đã có dòng chọn SKU theo danh mục NCC cũ — đồng ý thì xoá dòng.
 * Đặt NGOÀI `<form>` của wizard: submit của dialog nổi qua portal (React) sẽ kích "Tiếp tục".
 */
export function SupplierChangeDialog({ w }: { w: CreatePoWizard }) {
  return (
    <ConfirmDialog
      open={w.catalog.pendingSupplierId !== null}
      onOpenChange={(open) => {
        if (!open) w.catalog.cancelSupplierChange();
      }}
      title={C.changeSupplierTitle}
      description={C.changeSupplierDescription}
      confirmLabel={C.changeSupplierConfirm}
      onConfirm={w.catalog.confirmSupplierChange}
    />
  );
}
