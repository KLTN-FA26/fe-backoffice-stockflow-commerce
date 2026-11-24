import { DELIVERY_FAILURE_LABELS, ORDER_DELIVERY_FAILURE_LABELS } from "@/constants";
import { StatusDot } from "@/components/shared/StatusDot";

import { deliveryFailureCaseDisplay } from "../../delivery-failure-lifecycle";

import type { DeliveryFailureCase } from "../../delivery-failure-schemas";

/**
 * Trạng thái hồ sơ: tone theo status-map, nhãn riêng của lô hàng hoàn về — CANCELLED theo `closure` (F-4), không thêm
 * trạng thái mới vào status-map.
 */
export function DeliveryFailureStatus({
  failure,
}: {
  failure: Pick<DeliveryFailureCase, "status" | "closure">;
}) {
  const display = deliveryFailureCaseDisplay(failure);
  return <StatusDot domain="shipment" status={display.tone} label={display.label} />;
}

/** Lý do giao thất bại (BE `DeliveryFailureReason`); mã lạ → "Không rõ". */
export function failureReasonLabel(reason: DeliveryFailureCase["failureReason"]): string {
  return reason === "UNKNOWN"
    ? DELIVERY_FAILURE_LABELS.statusLabels.UNKNOWN
    : ORDER_DELIVERY_FAILURE_LABELS[reason];
}
