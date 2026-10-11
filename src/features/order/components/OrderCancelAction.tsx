"use client";

import { Ban } from "lucide-react";
import { useState } from "react";

import { FormDialog } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";

import { CancelForm } from "./OrderCancelForm";

import type { CancelOrder } from "./OrderCancelForm";

/**
 * Huỷ đơn phía admin — `POST /orders/{id}/admin-cancellation {reasonCode, note?, retainedPercent?}`.
 * Hiện hay không do `allowedOrderActions` quyết (trước Shipped + sales-order-cancellations:UPDATE).
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
        className="border-danger text-danger hover:bg-danger/10 w-full rounded-[var(--r-sm)] border bg-transparent px-3 py-2 text-[0.8125rem] font-medium"
      >
        <Ban className="size-3.5" /> Huỷ đơn
      </Button>
      <FormDialog open={open} onOpenChange={setOpen}>
        <CancelForm order={order} onClose={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}
