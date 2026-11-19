import { ORDER_DELIVERY_FAILURE_LABELS, UI_LABELS } from "@/constants";

import type { Shipment } from "@/features/shipping/types";

const C = UI_LABELS.shipping.shipment.correction;

/** Kết quả hiện tại → kết quả sửa thành (lô đã giao thì sửa thành giao thất bại và ngược lại). */
export function CorrectionCurrent({
  shipment,
  toFailed,
}: {
  shipment: Shipment["shipment"];
  toFailed: boolean;
}) {
  const reason =
    shipment.status === "DELIVERY_FAILED" && shipment.failureReason
      ? (ORDER_DELIVERY_FAILURE_LABELS[
          shipment.failureReason as keyof typeof ORDER_DELIVERY_FAILURE_LABELS
        ] ?? shipment.failureReason)
      : null;
  return (
    <dl className="grid grid-cols-[8.75rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-[0.8125rem]">
      <dt className="text-ink-tertiary">{C.current}</dt>
      <dd className="text-ink-primary">
        <span className="font-medium">
          {shipment.status === "DELIVERED" ? C.toDelivered : C.toFailed}
        </span>
        {reason && <span className="text-ink-tertiary"> · {reason}</span>}
      </dd>
      <dt className="text-ink-tertiary">{C.to}</dt>
      <dd className="text-ink-primary font-medium">{toFailed ? C.toFailed : C.toDelivered}</dd>
    </dl>
  );
}
