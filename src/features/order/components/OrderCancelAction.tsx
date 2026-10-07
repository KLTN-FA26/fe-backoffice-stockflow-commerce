"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Ban } from "lucide-react";
import { useState } from "react";

import { ORDER_LIMITS, UI_LABELS } from "@/constants";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { adminCancelErrorView } from "../errors";
import { useAdminCancelOrder } from "../mutations";
import { adminCancelOrderSchema } from "../schemas";
import { orderKeys } from "../queries";

import type { Order } from "../types";

interface OrderCancelActionProps {
  order: Pick<Order, "orderId" | "orderNumber">;
}

/** Lỗi cho thấy dữ liệu trên màn đã cũ (đơn đã đổi trạng thái / không còn trong phạm vi). */
const STALE_ERROR_CODES: readonly string[] = ["CONFLICT", "NOT_FOUND"];

/**
 * Nút "Huỷ đơn" + dialog bắt buộc lý do. Hiện hay không do `allowedOrderActions` quyết.
 * Dialog chỉ đóng khi huỷ thành công; lỗi tạm thời (mạng/5xx/thiếu lý do) giữ dialog + lý do
 * để thử lại. Lỗi do dữ liệu cũ → đóng dialog và tải lại đơn để nút tự ẩn theo trạng thái mới.
 */
export function OrderCancelAction({ order }: OrderCancelActionProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  // Đóng dialog qua callback của mutate() — chỉ áp cho lần huỷ này (api-conventions "Callback").
  const { mutate: adminCancel, isPending } = useAdminCancelOrder({
    onError: (error) => {
      if (STALE_ERROR_CODES.includes(error.code)) {
        setOpen(false);
        // Cả list lẫn detail đều đang giữ trạng thái cũ → làm mới toàn bộ dữ liệu đơn
        void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      }
      const view = adminCancelErrorView(error);
      toast.error(
        view.title,
        view.traceId
          ? `${view.detail} (${UI_LABELS.common.traceId}: ${view.traceId})`
          : view.detail,
      );
    },
  });

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => setOpen(true)}
        className="border-danger text-danger hover:bg-danger/10 w-full rounded-[var(--r-sm)] border bg-transparent px-3 py-2 text-[0.8125rem] font-medium"
      >
        <Ban className="size-3.5" /> Huỷ đơn
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Huỷ đơn hàng"
        description={`Huỷ đơn ${order.orderNumber}? Hành động này không thể hoàn tác.`}
        requireReason
        reasonLabel="Lý do huỷ"
        reasonMaxLength={ORDER_LIMITS.cancelReasonMax}
        variant="danger"
        confirmLabel="Huỷ đơn"
        loading={isPending}
        closeOnConfirm={false}
        onConfirm={(reason) => {
          // Validate bằng Input schema (trim, bắt buộc, ≤ 500) trước khi gửi
          const parsed = adminCancelOrderSchema.safeParse({ reason });
          if (!parsed.success) {
            toast.error(UI_LABELS.order.cancelFailedTitle, parsed.error.issues[0]?.message);
            return;
          }
          adminCancel(
            { id: order.orderId, reason: parsed.data.reason },
            { onSuccess: () => setOpen(false) },
          );
        }}
      />
    </>
  );
}
