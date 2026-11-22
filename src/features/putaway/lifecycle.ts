/**
 * Vòng đời nhiệm vụ cất hàng + gate thao tác (feature-architecture §6).
 *
 * Bảng chép từ docs 05 §5 "Chuyển tiếp cho phép": Pending → Done; Done và Cancelled là cuối. BE `PutawayStatus` còn
 * IN_PROGRESS — chỉ có trên nhiệm vụ lẻ cũ, BE từ chối cất (400 VALIDATION_FAILED) nên không có chuyển tiếp nào.
 */

import { PUTAWAY_TASK_PERMISSIONS, PUTAWAY_TASK_STATUS as S } from "@/constants";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { PutawayTask, PutawayTaskStatus } from "./types";

export const PUTAWAY_TASK_TRANSITIONS: Record<PutawayTaskStatus, readonly PutawayTaskStatus[]> = {
  [S.PENDING]: [S.DONE],
  [S.IN_PROGRESS]: [],
  // BR-06 (docs 05 §6): nhiệm vụ đã Done không sửa — chỉnh qua chuyển vị trí (module 11)
  [S.DONE]: [],
  [S.CANCELLED]: [],
};

/** Không còn thao tác nào trên nhiệm vụ (terminal hoặc task lẻ cũ BE không cho cất). */
export function isPutawayTaskClosed(status: PutawayTaskStatus): boolean {
  return PUTAWAY_TASK_TRANSITIONS[status].length === 0;
}

export type PutawayTaskGate =
  { canConfirm: true } | { canConfirm: false; reason: "done" | "closed" | "readOnly" };

/**
 * Thẻ xác nhận cất hiện hay không: cần nhiệm vụ còn chuyển sang DONE được VÀ quyền
 * `warehouse-putaway-tasks:UPDATE`. Không giới hạn người làm — mọi nhân viên kho thấy mọi nhiệm vụ của kho (docs 05
 * §2, giao việc theo người bị hoãn). UI-only — Backend phải re-check (quyền + phạm vi kho + BR-09).
 */
export function putawayTaskGate(
  task: Pick<PutawayTask, "status">,
  can: (code: PermissionCode) => boolean,
): PutawayTaskGate {
  if (task.status === S.DONE) return { canConfirm: false, reason: "done" };
  if (!PUTAWAY_TASK_TRANSITIONS[task.status].includes(S.DONE)) {
    return { canConfirm: false, reason: "closed" };
  }
  if (!can(PUTAWAY_TASK_PERMISSIONS.update)) return { canConfirm: false, reason: "readOnly" };
  return { canConfirm: true };
}
