import {
  DELIVERY_FAILURE_CASE_STATUS_DISPLAY,
  DELIVERY_FAILURE_LABELS,
  ORDER_DELIVERY_FAILURE_LABELS,
} from "@/constants";
import { StatusDot } from "@/components/shared/StatusDot";

import type { DeliveryFailureCase } from "../../delivery-failure-schemas";

/** Trạng thái hồ sơ: tone theo status-map, nhãn riêng của giao thất bại (không thêm trạng thái mới vào status-map). */
export function DeliveryFailureStatus({ status }: { status: DeliveryFailureCase["status"] }) {
  return (
    <StatusDot
      domain="shipment"
      status={DELIVERY_FAILURE_CASE_STATUS_DISPLAY[status]}
      label={DELIVERY_FAILURE_LABELS.statusLabels[status]}
    />
  );
}

/** Lý do giao thất bại (BE `DeliveryFailureReason`); mã lạ → "Không rõ". */
export function failureReasonLabel(reason: DeliveryFailureCase["failureReason"]): string {
  return reason === "UNKNOWN"
    ? DELIVERY_FAILURE_LABELS.statusLabels.UNKNOWN
    : ORDER_DELIVERY_FAILURE_LABELS[reason];
}
