/**
 * Timeline helper cho trang chi tiết PO.
 *
 * Trục chính = thứ tự 7 mã trạng thái BE (`PO_STATUSES`, DRAFT → CLOSED). Hai nhánh terminal rẽ
 * (`CANCELLED`, `CLOSED_SHORT`) được tách riêng. `status` luôn là 1 trong 7 giá trị BE
 * (đã zod-parse ở `api.ts`) nên không cần chuẩn hoá.
 */
import { PO_STATUS, PO_STATUSES } from "@/constants";

import type { PoStatus } from "@/features/purchase-order";

const PO_LIFECYCLE: PoStatus[] = PO_STATUSES.filter(
  (s) => s !== PO_STATUS.CANCELLED && s !== PO_STATUS.CLOSED_SHORT,
);

export interface LifecycleStep {
  label: PoStatus;
  done: boolean;
  current: boolean;
  /**
   * Bước có thể không xảy ra: một phiếu nhận xác nhận đủ SL một lần thì PO đi thẳng sang đã nhận đủ,
   * nên "Nhận một phần" chỉ chắc chắn đã qua khi PO đang/đã ở PARTIALLY_RECEIVED hoặc CLOSED_SHORT.
   */
  optional: boolean;
}

const step = (label: PoStatus, done: boolean, current: boolean, optional = false) => ({
  label,
  done,
  current,
  optional,
});

export function getLifecycleSteps(status: PoStatus): LifecycleStep[] {
  if (status === PO_STATUS.CANCELLED) {
    return PO_LIFECYCLE.map((label) =>
      step(label, false, false, label === PO_STATUS.PARTIALLY_RECEIVED),
    );
  }
  if (status === PO_STATUS.CLOSED_SHORT) {
    // CLOSED_SHORT chỉ đến từ PARTIALLY_RECEIVED → bước nhận một phần chắc chắn đã qua.
    return [...PO_LIFECYCLE, PO_STATUS.CLOSED_SHORT].map((label) =>
      step(label, label !== PO_STATUS.CLOSED, label === PO_STATUS.CLOSED_SHORT),
    );
  }
  const idx = PO_LIFECYCLE.indexOf(status);
  return PO_LIFECYCLE.map((label, i) => {
    const isPartial = label === PO_STATUS.PARTIALLY_RECEIVED;
    // Không biết PO có từng nhận một phần hay không (trừ khi đang ở đúng bước đó) → tuỳ đơn.
    const optional = isPartial && status !== PO_STATUS.PARTIALLY_RECEIVED;
    return step(label, i <= idx && !optional, i === idx, optional);
  });
}
