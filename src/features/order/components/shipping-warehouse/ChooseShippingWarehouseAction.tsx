"use client";

import { Warehouse } from "lucide-react";

import { ORDER_SHIPPING_WAREHOUSE_LABELS } from "@/constants";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { useChooseShippingWarehouse } from "../../shipping-warehouse-mutations";
import { cartonTotals, holdOutcome } from "../../shipping-warehouse-rules";
import { ORDER_ACTION_BUTTON, useOrderActionDialog } from "../useOrderActionDialog";

import { ChooseShippingWarehouseDialog } from "./ChooseShippingWarehouseDialog";

import type { ShippingCoverage } from "../../shipping-warehouse-schemas";
import type { Order } from "../../types";

const L = ORDER_SHIPPING_WAREHOUSE_LABELS;

/** Lời báo thành công theo kết quả giữ hàng mà BE trả về: đủ / một phần / chưa có thùng nào. */
export function successMessageOf(coverage: ShippingCoverage): string {
  const outcome = holdOutcome(coverage);
  if (outcome === "full") return L.success.full;
  const { held, cartons } = cartonTotals(coverage.lines);
  return outcome === "partial" ? L.success.partial(held, cartons) : L.success.none;
}

/**
 * Nút "Chọn / Đổi kho xuất" + hộp thoại (BE `PUT /orders/{id}/shipping-warehouse`, docs 17 §4.2 bước 2-3). Hiện hay không
 * do `shippingWarehouseControl` quyết (mã quyền `sales-order-shipping-warehouses:UPDATE` + đơn đúng bước). Thành công →
 * toast theo kết quả giữ hàng + đóng; 409 (đã giữ hàng / đơn đổi bước) → đóng, tải lại đơn, báo.
 */
export function ChooseShippingWarehouseAction({
  order,
  hasChosen,
}: {
  order: Pick<Order, "orderId" | "orderNumber">;
  hasChosen: boolean;
}) {
  const dialog = useOrderActionDialog("shippingWarehouse");
  const { mutate, isPending } = useChooseShippingWarehouse(dialog.hookOptions);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={dialog.show}
        className={ORDER_ACTION_BUTTON}
      >
        <Warehouse className="size-3.5" /> {hasChosen ? L.card.change : L.card.choose}
      </Button>
      {dialog.open && (
        <ChooseShippingWarehouseDialog
          order={order}
          isPending={isPending}
          error={dialog.error}
          onSubmit={({ warehouseId }) =>
            dialog.submit(
              (variables) =>
                mutate(variables, {
                  onSuccess: (coverage) => toast.success(successMessageOf(coverage)),
                }),
              { orderId: order.orderId, warehouseId },
            )
          }
          onClose={dialog.close}
        />
      )}
    </>
  );
}
