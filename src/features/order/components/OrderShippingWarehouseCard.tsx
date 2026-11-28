"use client";

import { ORDER_SHIPPING_WAREHOUSE_LABELS } from "@/constants";

import { useShippingCoverage } from "../shipping-warehouse-queries";
import { isWarehouseLocked, shippingWarehouseControl } from "../shipping-warehouse-rules";

import { ChooseShippingWarehouseAction } from "./shipping-warehouse/ChooseShippingWarehouseAction";
import { CoverageSummary } from "./shipping-warehouse/CoverageSummary";

import type { PermissionCode } from "@/lib/auth";
import type { Order } from "../types";

const L = ORDER_SHIPPING_WAREHOUSE_LABELS.card;

interface OrderShippingWarehouseCardProps {
  order: Pick<Order, "orderId" | "orderNumber" | "status">;
  can: (code: PermissionCode) => boolean;
}

/**
 * Kho xuất của đơn (docs 17 §4.2 bước 2-3, BR-22): kho Sale đã chọn, tình trạng giữ hàng ở đó và nút chọn / đổi kho. Hiện
 * khi đơn Đã xác nhận / Đang chờ hàng và người xem có mã quyền đọc hoặc ghi `sales-order-shipping-warehouses` (Sale chọn;
 * quản lý kho xem để biết đơn đã giữ đủ hàng chưa trước khi release). Đã giữ hàng ở kho hiện tại thì không đổi kho được.
 * UI-only — Backend phải re-check (`PUT /orders/{id}/shipping-warehouse`: quyền, bước của đơn, BR-22).
 */
export function OrderShippingWarehouseCard({ order, can }: OrderShippingWarehouseCardProps) {
  const control = shippingWarehouseControl(order, can);
  const coverage = useShippingCoverage(order.orderId, { enabled: !!control });
  if (!control) return null;
  const hasChosen = !!coverage.data?.warehouseId;
  const locked = isWarehouseLocked(coverage.data);
  return (
    <section
      id="order-shipping-warehouse"
      aria-label={L.title}
      className="border-border-default bg-bg-surface scroll-mt-20 rounded-[var(--card-radius)] border p-[var(--card-pad)]"
    >
      <h2 className="text-ink-primary mb-2 text-[0.9375rem] font-semibold">{L.title}</h2>
      {coverage.isPending && <p className="text-ink-secondary text-xs">{L.loading}</p>}
      {coverage.isError && (
        <p role="alert" className="text-danger text-xs">
          {L.failed}
        </p>
      )}
      {coverage.data && (
        <>
          <p className="text-ink-primary text-[0.8125rem] font-medium">
            {hasChosen
              ? coverage.data.warehouseCode
                ? L.chosen(coverage.data.warehouseCode, coverage.data.warehouseName)
                : coverage.data.warehouseName
                  ? L.chosen(coverage.data.warehouseName)
                  : L.chosen(L.chosenUnknown)
              : L.none}
          </p>
          {hasChosen ? (
            <CoverageSummary coverage={coverage.data} />
          ) : (
            <p className="text-ink-secondary mt-1 text-xs">{L.noneHint}</p>
          )}
        </>
      )}
      {control.canChoose && !locked && (
        <div className="mt-3">
          <ChooseShippingWarehouseAction order={order} hasChosen={hasChosen} />
        </div>
      )}
      {control.canChoose && locked && <p className="text-ink-tertiary mt-3 text-xs">{L.locked}</p>}
    </section>
  );
}
