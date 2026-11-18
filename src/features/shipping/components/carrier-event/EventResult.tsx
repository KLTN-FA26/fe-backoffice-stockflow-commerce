"use client";

import { UI_LABELS } from "@/constants";
import { carrierEventStatusKey } from "@/features/shipping/carrier-event-lifecycle";
import { StatusDot } from "@/components/shared/StatusDot";

import type { CarrierEventRow } from "@/features/shipping/carrier-event-types";

const E = UI_LABELS.shipping.carrierEvents;

/** Chấm + nhãn tiếng Việt của kết quả xử lý, qua `status-map` như mọi trạng thái khác (không hiện mã enum). */
export function EventResult({ result }: { result: CarrierEventRow["result"] }) {
  if (result === "UNKNOWN")
    return <span className="text-ink-secondary text-[0.8125rem]">{E.result.UNKNOWN}</span>;
  return <StatusDot domain="shipment" status={carrierEventStatusKey(result)} size="sm" />;
}
