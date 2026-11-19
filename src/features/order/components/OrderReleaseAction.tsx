"use client";

import { PackageCheck } from "lucide-react";
import { useState } from "react";

import {
  ORDER_DELIVERY_BATCH_PERMISSIONS,
  ORDER_RELEASE_LABELS,
  ORDER_SHIPPING_WAREHOUSE_PERMISSIONS,
} from "@/constants";
import { Button } from "@/components/ui/button";

import { useChosenShippingWarehouse } from "../queries";
import { OrderReleaseDialog } from "./OrderReleaseDialog";
import { ORDER_ACTION_BUTTON } from "./useOrderActionDialog";

import type { PermissionCode } from "@/lib/auth";
import type { OrderEstimateSlot } from "../estimate-slot";
import type { Order } from "../types";

interface OrderReleaseActionProps {
  order: Pick<Order, "orderId" | "orderNumber" | "lines">;
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
  // Kho Sale đã chọn (docs 17 §4.2 bước 2) → chọn sẵn ở hộp thoại; không có quyền đọc / chưa chọn thì để trống.
  const chosenWarehouse = useChosenShippingWarehouse(order.orderId, {
    enabled: can(ORDER_SHIPPING_WAREHOUSE_PERMISSIONS.read),
  });
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
          // UI-only — Backend phải re-check (lịch giao: GET /orders/{id}/delivery-batches cần sales-order-delivery-batches:READ)
          canChooseBatch={can(ORDER_DELIVERY_BATCH_PERMISSIONS.read)}
          defaultWarehouseId={chosenWarehouse.data}
          estimateSlot={estimateSlot}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
