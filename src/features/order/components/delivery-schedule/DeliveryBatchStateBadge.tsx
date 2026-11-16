import { cn } from "cn";

import { DELIVERY_BATCH_STATE_CODES, DELIVERY_BATCH_STATE_LABELS } from "@/constants";

import type { DeliveryBatch } from "../../delivery-batch-api";

type BatchState = DeliveryBatch["state"];

/** Màu chấm theo ngữ nghĩa (token `StatusDot`): chờ hàng = cảnh báo, đang giao = thông tin, đã giao = tích cực. */
const DOT: Record<BatchState, string> = {
  AWAITING_STOCK: "bg-dot-warning",
  READY: "bg-dot-positive",
  IN_DELIVERY: "bg-dot-info",
  DELIVERED: "bg-dot-positive",
  CLOSED: "bg-muted-tone",
  UNKNOWN: "bg-neutral",
};

/**
 * Trạng thái hiển thị của đợt giao (docs 17 §5.5) do hệ thống tính — hiện nhãn Việt, tooltip giữ mã nguyên văn của docs
 * (`Awaiting Stock`, `Ready`…) để đối chiếu.
 */
export function DeliveryBatchStateBadge({ state }: { state: BatchState }) {
  return (
    <span
      className="text-ink-primary inline-flex items-center gap-2 text-[0.8125rem] font-medium whitespace-nowrap"
      title={`${DELIVERY_BATCH_STATE_LABELS[state]} — ${DELIVERY_BATCH_STATE_CODES[state]}`}
    >
      <span className={cn("size-2.5 shrink-0 rounded-full", DOT[state])} />
      {DELIVERY_BATCH_STATE_LABELS[state]}
    </span>
  );
}
