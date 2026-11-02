import { PauseCircle } from "lucide-react";

import { ORDER_HOLD_PUBLIC_LABELS, ORDER_HOLD_REASON_LABELS } from "@/constants";
import { statusLabelVi } from "@/lib/status-map";

import type { Order } from "../types";

interface OrderHoldNoticeProps {
  order: Pick<Order, "holdReason" | "holdReasonPublic" | "holdNote" | "statusBeforeHold">;
}

/**
 * Trạng thái giữ đơn (nhân viên): lý do, ghi chú lúc giữ và bước đơn quay về khi gỡ giữ.
 * `holdReason` / `holdNote` chỉ có với nhân viên; thiếu thì rơi về nhãn công khai `holdReasonPublic`.
 */
export function OrderHoldNotice({ order }: OrderHoldNoticeProps) {
  const reason =
    order.holdReason && order.holdReason !== "UNKNOWN"
      ? ORDER_HOLD_REASON_LABELS[order.holdReason]
      : order.holdReasonPublic
        ? (ORDER_HOLD_PUBLIC_LABELS[order.holdReasonPublic] ?? order.holdReasonPublic)
        : null;
  const backTo = order.statusBeforeHold
    ? (statusLabelVi(order.statusBeforeHold, "order") ?? order.statusBeforeHold)
    : null;

  return (
    <div className="border-warning bg-warning/10 mb-3 rounded-[var(--r-sm)] border p-3 text-[0.8125rem]">
      <div className="text-ink-primary flex items-center gap-1.5 font-semibold">
        <PauseCircle className="text-warning size-3.5" aria-hidden="true" /> Đơn đang tạm giữ
      </div>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        <dt className="text-ink-secondary">Lý do</dt>
        <dd className="text-ink-primary">{reason ?? "—"}</dd>
        {order.holdNote && (
          <>
            <dt className="text-ink-secondary">Ghi chú</dt>
            <dd className="text-ink-primary break-words whitespace-pre-wrap">{order.holdNote}</dd>
          </>
        )}
        {backTo && (
          <>
            <dt className="text-ink-secondary">Gỡ giữ về</dt>
            <dd className="text-ink-primary">{backTo}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
