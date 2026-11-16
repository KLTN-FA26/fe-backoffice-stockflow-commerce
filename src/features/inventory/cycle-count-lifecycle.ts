import { CYCLE_COUNT_ACTION, CYCLE_COUNT_STATUS } from "@/constants/cycle-count";
import { CYCLE_COUNT_PERMISSIONS } from "@/constants/permissions";

import type { CycleCountStatus } from "./cycle-count-types";
import type { PermissionCode } from "@/lib/auth";

type CycleCountAction = (typeof CYCLE_COUNT_ACTION)[keyof typeof CYCLE_COUNT_ACTION];

// Docs 20 §5.2 "Phiếu kiểm kê". Completed (đếm lại = phiếu mới) and Cancelled are terminal.
export const CYCLE_COUNT_TRANSITIONS = {
  [CYCLE_COUNT_STATUS.PLANNED]: [CYCLE_COUNT_STATUS.IN_PROGRESS, CYCLE_COUNT_STATUS.CANCELLED],
  [CYCLE_COUNT_STATUS.IN_PROGRESS]: [CYCLE_COUNT_STATUS.COMPLETED, CYCLE_COUNT_STATUS.CANCELLED],
  [CYCLE_COUNT_STATUS.COMPLETED]: [],
  [CYCLE_COUNT_STATUS.CANCELLED]: [],
} as const satisfies Record<CycleCountStatus, readonly CycleCountStatus[]>;

// `status` is the open response string: an unrecognised backend status offers nothing to do.
export function isCycleCountOpen(status: string): boolean {
  return status === CYCLE_COUNT_STATUS.PLANNED || status === CYCLE_COUNT_STATUS.IN_PROGRESS;
}

// Counting (scan a carton, mark it not found, submit) is the counter's work: UPDATE, and only while the sheet is
// open (docs 20 §4.2 b). UI-only — CycleCountController re-checks the permission, the assignee and the status.
export function canCountCycleCount(status: string, can: (code: PermissionCode) => boolean) {
  return isCycleCountOpen(status) && can(CYCLE_COUNT_PERMISSIONS.update);
}

// Docs 20 §2, §4.2 d–e: submitting is the counter's (UPDATE); calling a sheet off and asking for a recount are
// for whoever decides counts (APPROVE) — a Completed sheet is never reopened, only recounted into a new one.
export function allowedCycleCountActions(
  status: string,
  can: (code: PermissionCode) => boolean,
): CycleCountAction[] {
  const actions: CycleCountAction[] = [];
  if (isCycleCountOpen(status)) {
    if (can(CYCLE_COUNT_PERMISSIONS.update)) actions.push(CYCLE_COUNT_ACTION.SUBMIT);
    if (can(CYCLE_COUNT_PERMISSIONS.approve)) actions.push(CYCLE_COUNT_ACTION.CANCEL);
  } else if (status === CYCLE_COUNT_STATUS.COMPLETED && can(CYCLE_COUNT_PERMISSIONS.approve)) {
    actions.push(CYCLE_COUNT_ACTION.RECOUNT);
  }
  return actions;
}
