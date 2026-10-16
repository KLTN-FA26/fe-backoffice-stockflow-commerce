"use client";

import { Ban } from "lucide-react";
import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { FormDialog } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";

import { DANGER_OUTLINE_BUTTON } from "./button-styles";
import { CancelForm } from "./OrderCancelForm";

import type { CancelOrder } from "./OrderCancelForm";

/**
 * Huỷ đơn phía admin — `POST /orders/{id}/admin-cancellation {reasonCode, note?, retainedPercent?}`.
 * Hiện hay không do `allowedOrderActions` quyết (trước Shipped + sales-order-cancellations:UPDATE)
 * — UI-only, Backend phải re-check (BR-031 + @RequiresPermission trên OrderController#adminCancel).
 * Dialog form (FormDialogBody `danger`) vì cần chọn mã lý do + % giữ lại — ConfirmDialog chỉ có ô
 * lý do tự do. Lỗi do dữ liệu cũ → đóng dialog và tải lại đơn để nút tự ẩn theo trạng thái mới.
 */
export function OrderCancelAction({ order }: { order: CancelOrder }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={`${DANGER_OUTLINE_BUTTON} w-full`}
      >
        <Ban className="size-3.5" /> {UI_LABELS.order.actions.cancel}
      </Button>
      <FormDialog open={open} onOpenChange={setOpen}>
        <CancelForm order={order} onClose={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}
