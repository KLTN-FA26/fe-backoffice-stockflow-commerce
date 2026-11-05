"use client";

import { Split } from "lucide-react";

import { ORDER_LIMITS, ORDER_PARTIAL_SHIPMENT_LABELS } from "@/constants";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { partialShipmentSchema } from "../input-schemas";
import { useDecidePartialShipment } from "../mutations";

import { OrderReasonDialog } from "./OrderReasonDialog";
import { ORDER_ACTION_BUTTON, useOrderActionDialog } from "./useOrderActionDialog";

import type { Order } from "../types";

type ActionOrder = Pick<Order, "orderId" | "orderNumber">;

/**
 * Cho phép / dừng giao một phần (BE PR #150): nút + hộp thoại ghi chú tuỳ chọn (≤ 500, vào lịch sử đơn).
 * Hiện hay không do `partialShipmentControl` quyết (mã quyền `sales-order-partial-shipments:UPDATE` + đơn chưa
 * khoá). `next` = giá trị sẽ đặt. Thành công → toast + đóng; 409 LOCKED → đóng, tải lại đơn, báo.
 */
export function OrderPartialShipmentAction({ order, next }: { order: ActionOrder; next: boolean }) {
  const dialog = useOrderActionDialog("partialShipment");
  const { mutate, isPending } = useDecidePartialShipment(dialog.hookOptions);
  const L = ORDER_PARTIAL_SHIPMENT_LABELS;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={dialog.show}
        className={ORDER_ACTION_BUTTON}
      >
        <Split className="size-3.5" /> {next ? L.allowButton : L.stopButton}
      </Button>
      {dialog.open && (
        <OrderReasonDialog
          title={next ? L.allowTitle : L.stopTitle}
          description={`${next ? L.allowDescription : L.stopDescription} (${order.orderNumber})`}
          submitLabel={next ? L.allowSubmit : L.stopSubmit}
          noteLabel={L.noteLabel}
          notePlaceholder={L.notePlaceholder}
          noteMax={ORDER_LIMITS.partialShipmentNoteMax}
          schema={partialShipmentSchema.pick({ note: true })}
          isPending={isPending}
          error={dialog.error}
          onSubmit={({ note }) =>
            mutate(
              { id: order.orderId, allowed: next, note },
              { onSuccess: () => toast.success(next ? L.allowSuccess : L.stopSuccess) },
            )
          }
          onClose={dialog.close}
        />
      )}
    </>
  );
}
