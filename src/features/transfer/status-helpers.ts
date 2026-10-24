/**
 * Transfer order — câu thay nút và các vị từ trạng thái dùng cho hiển thị (tách khỏi `lifecycle.ts` cho gọn).
 */

import { TRANSFER_STATUS as S, UI_LABELS } from "@/constants";

import type { TransferStatus } from "@/constants";

const NO_ACTIONS = UI_LABELS.transfer.noActions;

/**
 * Câu thay cho nút khi người dùng không còn thao tác nào với lệnh — `Record` để thêm trạng thái mới
 * mà quên câu thì compiler báo.
 */
export const TRANSFER_NO_ACTION_REASON: Record<TransferStatus, string> = {
  DRAFT: NO_ACTIONS.viewOnly,
  PENDING_APPROVAL: NO_ACTIONS.pendingApproval,
  APPROVED: NO_ACTIONS.viewOnly,
  PICKING: NO_ACTIONS.viewOnly,
  IN_TRANSIT: NO_ACTIONS.inTransit,
  PARTIALLY_RECEIVED: NO_ACTIONS.partiallyReceived,
  RECEIVED: NO_ACTIONS.received,
  COMPLETED: NO_ACTIONS.terminal,
  CLOSED: NO_ACTIONS.terminal,
  CANCELLED: NO_ACTIONS.terminal,
};

/** Chỉ DRAFT sửa được (BE TRANSFER_ORDER_NOT_EDITABLE, SCRUM-462). */
export function isTransferEditable(status: TransferStatus): boolean {
  return status === S.DRAFT;
}

/** Hàng đang trên đường tới kho đích (chưa nhận đủ). */
export function isTransferInTransit(status: TransferStatus): boolean {
  return status === S.IN_TRANSIT || status === S.PARTIALLY_RECEIVED;
}

/** Đã rời kho nguồn: hiện SL xuất + thời điểm xuất. */
export function isTransferDispatched(status: TransferStatus): boolean {
  return (
    [S.IN_TRANSIT, S.PARTIALLY_RECEIVED, S.RECEIVED, S.COMPLETED, S.CLOSED] as TransferStatus[]
  ).includes(status);
}
