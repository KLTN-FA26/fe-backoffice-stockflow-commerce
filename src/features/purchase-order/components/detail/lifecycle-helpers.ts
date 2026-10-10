/**
 * Timeline helper cho trang chi tiết PO.
 *
 * Trục chính = thứ tự trạng thái BE D4 (`PO_STATUSES`, DRAFT → CLOSED, BE PR #71), bỏ nhánh rẽ
 * `CANCELLED`. `status` luôn là 1 trong 8 giá trị BE (đã zod-parse ở `api.ts`).
 */
import { PO_STATUS, PO_STATUSES } from "@/constants";

import type { PoStatus } from "@/features/purchase-order";

const PO_LIFECYCLE: PoStatus[] = PO_STATUSES.filter((s) => s !== PO_STATUS.CANCELLED);

export interface LifecycleStep {
  label: PoStatus;
  done: boolean;
  current: boolean;
  /**
   * Bước có thể không xảy ra: một phiếu nhận đủ đưa thẳng CONFIRMED → RECEIVED, và đóng thiếu đi
   * thẳng PARTIALLY_RECEIVED → CLOSED. Nên "Nhận một phần" / "Đã nhận đủ" chỉ chắc chắn khi PO
   * đang ở đúng bước đó.
   */
  optional: boolean;
}

const step = (label: PoStatus, done: boolean, current: boolean, optional = false) => ({
  label,
  done,
  current,
  optional,
});

const RECEIVING_STEPS: readonly PoStatus[] = [PO_STATUS.PARTIALLY_RECEIVED, PO_STATUS.RECEIVED];

export function getLifecycleSteps(status: PoStatus): LifecycleStep[] {
  if (status === PO_STATUS.CANCELLED) {
    return PO_LIFECYCLE.map((label) => step(label, false, false, RECEIVING_STEPS.includes(label)));
  }
  const idx = PO_LIFECYCLE.indexOf(status);
  return PO_LIFECYCLE.map((label, i) => {
    // Không biết PO có từng ở bước nhận này hay không (trừ khi đang ở đúng bước đó) → tuỳ đơn.
    const optional = RECEIVING_STEPS.includes(label) && status !== label;
    return step(label, i <= idx && !optional, i === idx, optional);
  });
}
