import { SUPPLIER_ITEM_UI_LABELS } from "@/constants";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import type { SupplierItemDeletion } from "./useSupplierItemsState";

const L = SUPPLIER_ITEM_UI_LABELS;

/**
 * Xác nhận xoá một dòng danh mục NCC. Dòng đang ưu tiên → cảnh báo NCC mặc định của SKU KHÔNG bị gỡ
 * (BE `SupplierItemServiceImpl#delete` giữ master data). `deletion.target` giữ dòng cuối sau khi đóng
 * để nội dung không đổi trong lúc animation đóng.
 */
export function SupplierItemDeleteDialog({ deletion }: { deletion: SupplierItemDeletion }) {
  const { target } = deletion;
  return (
    <ConfirmDialog
      open={deletion.isOpen}
      onOpenChange={(open) => !open && deletion.close()}
      title={L.deleteTitle}
      description={
        target?.preferred
          ? `${L.deleteDescription(target.sku)} ${L.deletePreferredWarning}`
          : L.deleteDescription(target?.sku ?? "")
      }
      confirmLabel={L.action.delete}
      loading={deletion.isPending}
      closeOnConfirm={false}
      error={deletion.error}
      onConfirm={deletion.confirm}
    />
  );
}
