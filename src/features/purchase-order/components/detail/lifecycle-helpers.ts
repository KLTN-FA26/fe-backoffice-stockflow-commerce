import { PO_STATUS } from "@/constants";

import type { PoStatus } from "@/features/purchase-order";

const PO_LIFECYCLE: PoStatus[] = [
  PO_STATUS.DRAFT,
  PO_STATUS.APPROVED,
  PO_STATUS.SENT,
  PO_STATUS.PARTIALLY_RECEIVED,
  PO_STATUS.CLOSED,
];

export function getLifecycleSteps(status: PoStatus) {
  if (status === PO_STATUS.CANCELLED) {
    return PO_LIFECYCLE.map((step) => ({ label: step as string, done: false, current: false }));
  }
  if (status === PO_STATUS.CLOSED_SHORT) {
    return [...PO_LIFECYCLE, PO_STATUS.CLOSED_SHORT].map((step) => ({
      label: step as string,
      done: step !== PO_STATUS.CLOSED,
      current: step === PO_STATUS.CLOSED_SHORT,
    }));
  }
  const idx = PO_LIFECYCLE.indexOf(status);
  if (idx === -1)
    return PO_LIFECYCLE.map((s) => ({ label: s as string, done: false, current: false }));
  return PO_LIFECYCLE.map((step, i) => ({
    label: step as string,
    done: i <= idx,
    current: i === idx,
  }));
}
