/**
 * Timeline helper cho trang chi tiết PO.
 *
 * Trục chính derive từ `PO_TRANSITIONS` (single source ở `src/lib/domain/lifecycle.ts`) để
 * khi BE đổi bảng chuyển trạng thái thì timeline tự theo. Hai nhánh terminal rẽ
 * (`CANCELLED`, `CLOSED_SHORT`) được tách riêng. `status` luôn là 1 trong 7 giá trị BE
 * (đã zod-parse ở `api.ts`) nên không cần chuẩn hoá.
 */
import { PO_STATUS } from "@/constants";

import { PO_TRANSITIONS } from "@/features/purchase-order/lifecycle";

import type { PoStatus } from "@/features/purchase-order";

const PO_LIFECYCLE: PoStatus[] = (Object.keys(PO_TRANSITIONS) as PoStatus[]).filter(
  (s) => s !== PO_STATUS.CANCELLED && s !== PO_STATUS.CLOSED_SHORT,
);

export interface LifecycleStep {
  label: PoStatus;
  done: boolean;
  current: boolean;
}

export function getLifecycleSteps(status: PoStatus): LifecycleStep[] {
  if (status === PO_STATUS.CANCELLED) {
    return PO_LIFECYCLE.map((label) => ({ label, done: false, current: false }));
  }
  if (status === PO_STATUS.CLOSED_SHORT) {
    return [...PO_LIFECYCLE, PO_STATUS.CLOSED_SHORT].map((label) => ({
      label,
      done: label !== PO_STATUS.CLOSED,
      current: label === PO_STATUS.CLOSED_SHORT,
    }));
  }
  const idx = PO_LIFECYCLE.indexOf(status);
  return PO_LIFECYCLE.map((label, i) => ({ label, done: i <= idx, current: i === idx }));
}
