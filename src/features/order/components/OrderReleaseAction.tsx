"use client";

import { PackageCheck } from "lucide-react";
import { useState } from "react";

import { ORDER_PERMISSIONS, ORDER_RELEASE_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import { OrderReleaseDialog } from "./OrderReleaseDialog";
import { ORDER_ACTION_BUTTON } from "./useOrderActionDialog";

import type { PermissionCode } from "@/lib/auth";
import type { OrderEstimateSlot } from "../estimate-slot";
import type { Order } from "../types";

interface OrderReleaseActionProps {
  order: Pick<
    Order,
    "orderId" | "orderNumber" | "deliveryMode" | "paymentTerm" | "balancePolicy" | "printLineCount"
  >;
  can: (code: PermissionCode) => boolean;
  estimateSlot?: OrderEstimateSlot;
}

/**
 * Nút "Release đơn" + hộp thoại chọn kho / hình thức giao (BE `OrderReleaseController`, SCRUM-423, LP-1). Hiện khi
 * `allowedOrderActions` cho phép (đơn CONFIRMED + `sales-orders:APPROVE`). Hộp thoại chỉ mount khi mở nên mỗi lần mở là
 * một lần thử mới (form và Idempotency-Key sạch).
 */
export function OrderReleaseAction({ order, can, estimateSlot }: OrderReleaseActionProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={ORDER_ACTION_BUTTON}
      >
        <PackageCheck className="size-3.5" /> {ORDER_RELEASE_LABELS.button}
      </Button>
      {open && (
        <OrderReleaseDialog
          order={order}
          // UI-only — Backend phải re-check (release với hình thức khác của đơn: 403 nếu thiếu mã quyền)
          canChangeMode={can(ORDER_PERMISSIONS.deliveryModes)}
          estimateSlot={estimateSlot}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
