"use client";

import { PackageCheck } from "lucide-react";

import { ORDER_PERMISSIONS, ORDER_RELEASE_LABELS } from "@/constants";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { useReleaseOrder } from "../mutations";

import { OrderReleaseDialog } from "./OrderReleaseDialog";
import { ORDER_ACTION_BUTTON, useOrderActionDialog } from "./useOrderActionDialog";

import type { PermissionCode } from "@/lib/auth";
import type { OrderEstimateSlot } from "../estimate-slot";
import type { Order } from "../types";

interface OrderReleaseActionProps {
  order: Pick<Order, "orderId" | "orderNumber" | "deliveryMode" | "paymentTerm" | "balancePolicy">;
  can: (code: PermissionCode) => boolean;
  estimateSlot?: OrderEstimateSlot;
}

/**
 * Nút "Release đơn" + hộp thoại chọn kho / hình thức giao (BE `OrderReleaseController`, SCRUM-423, LP-1).
 * Hiện khi `allowedOrderActions` cho phép (đơn CONFIRMED + `sales-orders:APPROVE`). Thành công → toast + đóng;
 * 409 DELIVERY_MODE_FTL_NO_COD → giữ hộp thoại, báo "Sale đổi cách thu trước" (chưa release gì).
 */
export function OrderReleaseAction({ order, can, estimateSlot }: OrderReleaseActionProps) {
  const dialog = useOrderActionDialog("release");
  const { mutate, isPending } = useReleaseOrder(dialog.hookOptions);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={dialog.show}
        className={ORDER_ACTION_BUTTON}
      >
        <PackageCheck className="size-3.5" /> {ORDER_RELEASE_LABELS.button}
      </Button>
      {dialog.open && (
        <OrderReleaseDialog
          order={order}
          // UI-only — Backend phải re-check (release với hình thức khác của đơn: 403 nếu thiếu mã quyền)
          canChangeMode={can(ORDER_PERMISSIONS.deliveryModes)}
          estimateSlot={estimateSlot}
          isPending={isPending}
          error={dialog.error}
          onSubmit={(input) =>
            mutate(input, { onSuccess: () => toast.success(ORDER_RELEASE_LABELS.success) })
          }
          onClose={dialog.close}
        />
      )}
    </>
  );
}
