"use client";

import { PackageCheck } from "lucide-react";
import { useState } from "react";

import { ORDER_RELEASE_LABELS, SALES_CONTRACT_PERMISSIONS } from "@/constants";
import { Button } from "@/components/ui/button";

import { OrderReleaseDialog } from "./OrderReleaseDialog";
import { ORDER_ACTION_BUTTON } from "./useOrderActionDialog";

import type { PermissionCode } from "@/lib/auth";
import type { OrderEstimateSlot } from "../estimate-slot";
import type { Order } from "../types";

interface OrderReleaseActionProps {
  order: Pick<Order, "orderId" | "orderNumber">;
  can: (code: PermissionCode) => boolean;
  estimateSlot?: OrderEstimateSlot;
}

/**
 * Nút "Release đơn" + hộp thoại chọn kho xuất / đợt giao (BE `OrderReleaseController`, docs 17 §4.2 bước 5). Hiện khi
 * `allowedOrderActions` cho phép (đơn CONFIRMED + `sales-order-releases:UPDATE` — quản lý kho của kho xuất). Hộp thoại chỉ mount khi mở nên mỗi lần mở là
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
          // UI-only — Backend phải re-check (lịch giao: GET /orders/{id}/delivery-batches cần sales-contracts:READ)
          canChooseBatch={can(SALES_CONTRACT_PERMISSIONS.read)}
          estimateSlot={estimateSlot}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
