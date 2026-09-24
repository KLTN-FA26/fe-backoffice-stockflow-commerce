/**
 * Timeline helper cho trang chi tiết PO.
 *
 * `PO_LIFECYCLE` là trục chính của timeline, derive trực tiếp từ
 * `PO_TRANSITIONS` (single source ở `src/lib/domain/lifecycle.ts`) để khi BE
 * đổi bảng chuyển trạng thái (SCRUM-113/116) thì timeline tự theo, không phải
 * sửa hardcode. Chỉ lọc 2 nhánh terminal riêng (`CANCELLED`, `CLOSED_SHORT`)
 * để render như nhánh rẽ — vẫn lấy key từ `PO_STATUS` (constants) nên không
 * lệch BE.
 *
 * Dual-source note: `normStatus()` chuẩn hóa status trước khi tra timeline,
 * cùng lý do như `features/purchase-order/lifecycle.ts:normalizePoStatus`.
 * Mock seed trả về Title Case (`Draft`, `Confirmed`, `Partially Received`)
 * trong khi `PO_LIFECYCLE`/`PO_TRANSITIONS` chỉ có SCREAMING_SNAKE (`DRAFT`,
 * `SENT`, `PARTIALLY_RECEIVED`). Không normalize thì
 * `PO_LIFECYCLE.indexOf("Draft")` luôn `-1` và `isPoTerminal("Draft")` guard
 * sai, từng gây crash `isTerminal(undefined.length)` ở
 * `/admin/purchase-orders/[id]` (stack `getLifecycleSteps → isPoTerminal →
 * isTerminal`).
 */
import { PO_STATUS } from "@/constants";

import type { PoStatus } from "@/features/purchase-order";
import { PO_TRANSITIONS, isPoTerminal } from "@/features/purchase-order/lifecycle";

const PO_LIFECYCLE: PoStatus[] = (Object.keys(PO_TRANSITIONS) as PoStatus[]).filter(
  (s) => s !== PO_STATUS.CANCELLED && s !== PO_STATUS.CLOSED_SHORT,
);

function normStatus(status: PoStatus | string): PoStatus {
  if ((status as string) in PO_TRANSITIONS) return status as PoStatus;
  const upper = String(status)
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if ((upper as string) in PO_TRANSITIONS) return upper as PoStatus;
  const legacyMap: Record<string, PoStatus> = {
    CONFIRMED: "SENT",
    RECEIVED: "CLOSED",
    PENDING_APPROVAL: "APPROVED",
  };
  return (legacyMap[upper] as PoStatus | undefined) ?? (upper as PoStatus);
}

export function getLifecycleSteps(status: PoStatus) {
  const n = normStatus(status);
  if (isPoTerminal(n) && n === PO_STATUS.CANCELLED) {
    return PO_LIFECYCLE.map((step) => ({ label: step as string, done: false, current: false }));
  }
  if (n === PO_STATUS.CLOSED_SHORT) {
    return [...PO_LIFECYCLE, PO_STATUS.CLOSED_SHORT].map((step) => ({
      label: step as string,
      done: step !== PO_STATUS.CLOSED,
      current: step === PO_STATUS.CLOSED_SHORT,
    }));
  }
  const idx = PO_LIFECYCLE.indexOf(n);
  if (idx === -1)
    return PO_LIFECYCLE.map((s) => ({ label: s as string, done: false, current: false }));
  return PO_LIFECYCLE.map((step, i) => ({
    label: step as string,
    done: i <= idx,
    current: i === idx,
  }));
}
