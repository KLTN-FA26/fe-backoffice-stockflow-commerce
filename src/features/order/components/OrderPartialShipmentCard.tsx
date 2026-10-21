import { ORDER_PARTIAL_SHIPMENT_LABELS, ORDER_PERMISSIONS } from "@/constants";

import { partialShipmentControl } from "../partial-shipment";

import { OrderPartialShipmentAction } from "./OrderPartialShipmentAction";

import type { PermissionCode } from "@/lib/auth";
import type { Order } from "../types";

interface OrderPartialShipmentCardProps {
  order: Pick<
    Order,
    | "orderId"
    | "orderNumber"
    | "status"
    | "statusBeforeHold"
    | "allowPartialShipment"
    | "printLinesReady"
  >;
  can: (code: PermissionCode) => boolean;
}

/**
 * Giao một phần của đơn (BE PR #150, PACK-PARTIAL): Sales quyết đơn có được đóng / bàn giao từng phần không
 * — kho không còn tự quyết (kho thấy 409 `PACK_PARTIAL_NOT_ALLOWED` / `ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED`
 * nếu đơn chưa bật). Ai đọc được đơn đều thấy trạng thái; nút chỉ hiện với người có mã quyền
 * `sales-order-partial-shipments:UPDATE` khi đơn chưa khoá (`partialShipmentControl`). Không có cờ từ BE →
 * không hiện gì (không đoán).
 */
export function OrderPartialShipmentCard({ order, can }: OrderPartialShipmentCardProps) {
  const control = partialShipmentControl(order, can);
  if (!control) return null;
  const L = ORDER_PARTIAL_SHIPMENT_LABELS;
  const lockText =
    control.lock === "awaiting-prints"
      ? L.lockedAwaitingPrints
      : control.lock === "closed"
        ? L.lockedClosed
        : null;

  return (
    <section
      aria-label={L.title}
      className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]"
    >
      <h2 className="text-ink-primary mb-2 text-[0.9375rem] font-semibold">{L.title}</h2>
      <p className="text-ink-primary text-[0.8125rem] font-medium">
        {control.allowed ? L.stateOn : L.stateOff}
      </p>
      <p className="text-ink-secondary mt-1 text-xs">{control.allowed ? L.hintOn : L.hintOff}</p>
      {control.canChange && (
        <div className="mt-3">
          <OrderPartialShipmentAction order={order} next={control.next} />
        </div>
      )}
      {lockText && can(ORDER_PERMISSIONS.partialShipment) && (
        <p className="text-ink-tertiary mt-3 text-xs">{lockText}</p>
      )}
    </section>
  );
}
