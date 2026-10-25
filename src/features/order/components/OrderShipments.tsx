import Link from "next/link";
import { Truck } from "lucide-react";

import {
  ADMIN_ROUTES,
  ORDER_DELIVERY_FAILURE_LABELS,
  ORDER_SHIPMENT_STATUS_DISPLAY,
  SHIPMENT_PERMISSIONS,
  UI_LABELS,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { formatDateTime } from "@/lib/format/date";
import { formatMoney } from "@/lib/format";
import { StatusDot } from "@/components/shared/StatusDot";

import type { Order } from "../types";

interface OrderShipmentsProps {
  order: Pick<Order, "shipments" | "lines" | "currency">;
}

function failureLabel(reason: string): string {
  return reason in ORDER_DELIVERY_FAILURE_LABELS
    ? ORDER_DELIVERY_FAILURE_LABELS[reason as keyof typeof ORDER_DELIVERY_FAILURE_LABELS]
    : reason;
}

/**
 * Các lô giao đã bàn giao cho hãng vận chuyển (split shipments, G4-Q3), cũ nhất trước.
 * Mỗi lô có trạng thái riêng; đơn không chia lô thì không hiện card này.
 */
export function OrderShipments({ order }: OrderShipmentsProps) {
  // Lô giao của đơn CHÍNH là lô giao của kho (`fk_order_shipment_shipment`, BE PR #137): cùng id. Mở
  // chi tiết lô cần quyền đọc `fulfillment-shipments` — thiếu thì chỉ hiện chữ, không dẫn tới trang 403.
  // UI-only — Backend phải re-check (GET /fulfillment/shipments/{id}).
  const canOpenShipment = useCan(SHIPMENT_PERMISSIONS.read);
  if (order.shipments.length === 0) return null;
  const skuOf = new Map(order.lines.map((line) => [line.lineId, line.sku]));

  return (
    <section
      aria-label="Lô giao"
      className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]"
    >
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Truck className="text-accent size-4" />
        Lô giao ({order.shipments.length})
      </h2>
      <ol className="space-y-3">
        {order.shipments.map((shipment, index) => (
          <li
            key={shipment.shipmentId}
            className="border-border-default rounded-[var(--r-sm)] border p-3 text-[0.8125rem]"
          >
            <div className="flex items-center justify-between gap-2">
              {canOpenShipment ? (
                <Link
                  href={ADMIN_ROUTES.shipments.detail(shipment.shipmentId)}
                  aria-label={`${UI_LABELS.shipping.orderShipments.open} ${index + 1}`}
                  className="text-accent font-semibold hover:underline"
                >
                  Lô {index + 1}
                </Link>
              ) : (
                <span className="text-ink-primary font-semibold">Lô {index + 1}</span>
              )}
              <StatusDot
                domain="shipment"
                status={ORDER_SHIPMENT_STATUS_DISPLAY[shipment.status]}
              />
            </div>
            <dl className="text-ink-secondary mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
              {shipment.handedOverAt && (
                <>
                  <dt>Bàn giao</dt>
                  <dd className="text-ink-primary tabular-nums">
                    {formatDateTime(shipment.handedOverAt)}
                  </dd>
                </>
              )}
              {shipment.outcomeAt && (
                <>
                  <dt>Kết quả</dt>
                  <dd className="text-ink-primary tabular-nums">
                    {formatDateTime(shipment.outcomeAt)}
                  </dd>
                </>
              )}
              {shipment.failureReason && (
                <>
                  <dt>Lý do thất bại</dt>
                  <dd className="text-ink-primary">{failureLabel(shipment.failureReason)}</dd>
                </>
              )}
              {shipment.amount !== null && (
                <>
                  <dt>Giá trị hàng</dt>
                  <dd className="text-ink-primary font-mono tabular-nums">
                    {formatMoney(shipment.amount, order.currency)}
                  </dd>
                </>
              )}
              {shipment.billedAmount !== null && (
                <>
                  <dt>Đã ghi công nợ</dt>
                  <dd className="text-ink-primary font-mono tabular-nums">
                    {formatMoney(shipment.billedAmount, order.currency)}
                  </dd>
                </>
              )}
            </dl>
            {shipment.lines.length > 0 && (
              <ul className="text-ink-secondary mt-2 space-y-0.5 text-xs">
                {shipment.lines.map((line) => (
                  <li key={line.lineId} className="flex justify-between gap-2">
                    <span className="truncate font-mono">
                      {skuOf.get(line.lineId) ?? line.lineId}
                    </span>
                    <span className="tabular-nums">×{line.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
