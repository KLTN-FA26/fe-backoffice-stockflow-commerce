import { ORDER_NEXT_STEP_LABELS } from "@/constants";

import type { OrderReadStatus } from "../types";

const L = ORDER_NEXT_STEP_LABELS;

/**
 * Dòng "Bước tiếp theo: Lập hợp đồng ↓" của thẻ trạng thái (BO-UX-22): việc thật của đơn nháp nằm ở khối Hợp đồng bên
 * trái, nên thẻ chỉ đường tới đó. Trạng thái khác: không hiện (nút của thẻ đã là việc tiếp theo).
 */
export function OrderNextStep({ status }: { status: OrderReadStatus }) {
  if (status !== "Draft" && status !== "Pending Contract" && status !== "Pending Payment")
    return null;
  const step = L[status];
  return (
    <p className="text-ink-secondary mb-3 text-center text-xs">
      {L.prefix}{" "}
      <a href={step.anchor} className="text-accent-text font-medium hover:underline">
        {step.text} <span aria-hidden="true">↓</span>
      </a>
    </p>
  );
}
