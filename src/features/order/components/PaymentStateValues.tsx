import { formatMoney } from "@/lib/format";
import { formatDateTime } from "@/lib/format/date";
import { STATUS_LABEL_VI } from "@/lib/status-map";

import { creditState, depositState } from "../selectors";

import type { ReactNode } from "react";
import type { Order } from "../types";

type Tone = "positive" | "warning" | "neutral";

const TONE_DOT: Record<Tone, string> = {
  positive: "bg-positive",
  warning: "bg-warning",
  neutral: "bg-neutral",
};

/**
 * Trạng thái suy ra (cọc / công nợ) — không phải union trạng thái docs nên không qua status-map.
 * Chữ dùng màu ink (contrast ≥ 4.5:1), chấm màu mang ý nghĩa tone.
 */
function DerivedState({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="text-ink-secondary inline-flex items-center gap-1.5 text-xs">
      <span aria-hidden="true" className={`size-1.5 rounded-full ${TONE_DOT[tone]}`} />
      {children}
    </span>
  );
}

/** Cọc — docs 15 BR-02 / docs 19 BR-09: chưa đủ cọc thì không release sang sản xuất. */
export function DepositValue({ order }: { order: Order }) {
  const state = depositState(order);
  const required = order.depositRequired;
  return (
    <span className="flex flex-col items-end">
      {required !== null && (
        <span className="font-mono tabular-nums">{formatMoney(required, order.currency)}</span>
      )}
      {state === "received" ? (
        <DerivedState tone="positive">
          Đã nhận cọc
          {order.depositReceivedAt ? ` · ${formatDateTime(order.depositReceivedAt)}` : ""}
        </DerivedState>
      ) : (
        <DerivedState tone="warning">Chưa nhận cọc</DerivedState>
      )}
    </span>
  );
}

/**
 * Công nợ — docs 14 BR-06 (SCRUM-427). Chỉ nêu TRẠNG THÁI: `OrderResponse` không mang lý do giữ
 * (vượt hạn mức / nợ quá hạn / lý do khác), nên On Hold hiện "Tạm giữ" — cùng nhãn trạng thái
 * On Hold (lib/status-map) — không đoán nguyên nhân. Lý do chứng minh được nằm ở hàng đợi công nợ.
 */
export function CreditValue({ order }: { order: Order }) {
  const onHold = creditState(order) === "on-hold";
  return (
    <span className="flex flex-col items-end">
      {order.creditTermDays !== null && <span>Kỳ hạn {order.creditTermDays} ngày</span>}
      <DerivedState tone={onHold ? "warning" : "neutral"}>
        {onHold ? STATUS_LABEL_VI["On Hold"] : "Đã qua kiểm hạn mức"}
      </DerivedState>
    </span>
  );
}
