/**
 * Transfer order — action-gating (feature-architecture §6).
 *
 * Bảng chuyển trạng thái `TRANSFER_TRANSITIONS` (lib/domain, = docs 10 §5 = BE TransferStatus).
 * Quyền: mã thật từ `/identity/me/permissions` theo `@RequiresPermission` của TransferOrderController.
 * UI-only — Backend phải re-check (TransferOrderServiceImpl + @RequiresPermission + phạm vi kho BR-SEC-002).
 */

import { TRANSFER_PERMISSIONS, TRANSFER_STATUS, UI_LABELS } from "@/constants";
import { TRANSFER_TRANSITIONS } from "@/lib/domain/lifecycle";

import type { TransferStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth";

const LABEL = UI_LABELS.transfer.action;
const P = TRANSFER_PERMISSIONS;
const S = TRANSFER_STATUS;

export type TransferActionCode =
  | "edit"
  | "submit"
  | "approve"
  | "reject"
  | "startPicking"
  | "cancelPicking"
  | "dispatch"
  | "cancel";

export interface TransferAction {
  readonly code: TransferActionCode;
  readonly label: string;
  readonly permissions: readonly PermissionCode[];
  readonly fromStatuses: readonly TransferStatus[];
  /** Đích trong bảng chuyển trạng thái; thiếu = không đổi trạng thái (sửa nháp). */
  readonly targetStatus?: TransferStatus;
  readonly tone: "primary" | "secondary" | "danger";
  /** BE `ReasonRequest` bắt buộc lý do. */
  readonly requiresReason?: boolean;
  /** Người gửi duyệt không tự duyệt / từ chối — four-eyes (docs 10 §2: Approver phê duyệt TO; BE TransferOrder TRANSFER_SELF_APPROVAL / ck_transfer_order_four_eyes). */
  readonly fourEyes?: boolean;
}

export interface TransferGateState {
  status: TransferStatus;
  submittedBy?: string | null;
}

export interface AllowedTransferAction {
  action: TransferAction;
  /** Có lý do → hiện nút nhưng khoá, kèm chú thích. */
  disabledReason?: string;
}

export const TRANSFER_ACTIONS: readonly TransferAction[] = [
  {
    code: "dispatch",
    label: LABEL.dispatch,
    // docs 10 §4 bước 5: kho nguồn xác nhận xuất sau khi lấy + đóng gói
    permissions: [P.update],
    fromStatuses: [S.PICKING],
    targetStatus: S.IN_TRANSIT,
    tone: "primary",
  },
  {
    code: "startPicking",
    label: LABEL.startPicking,
    permissions: [P.update],
    fromStatuses: [S.APPROVED],
    targetStatus: S.PICKING,
    tone: "primary",
  },
  {
    code: "approve",
    label: LABEL.approve,
    permissions: [P.approve],
    fromStatuses: [S.PENDING_APPROVAL],
    targetStatus: S.APPROVED,
    tone: "primary",
    fourEyes: true,
  },
  {
    code: "submit",
    label: LABEL.submit,
    // DRAFT → PENDING_APPROVAL, hoặc thẳng APPROVED khi tổng SL ≤ ngưỡng (docs 10 §4 bước 3 + §5 "Draft → Approved: Submit (dưới ngưỡng)")
    permissions: [P.create],
    fromStatuses: [S.DRAFT],
    targetStatus: S.PENDING_APPROVAL,
    tone: "primary",
  },
  {
    code: "edit",
    label: LABEL.edit,
    // BE TRANSFER_ORDER_NOT_EDITABLE ngoài DRAFT (SCRUM-462)
    permissions: [P.create],
    fromStatuses: [S.DRAFT],
    tone: "secondary",
  },
  {
    code: "reject",
    label: LABEL.reject,
    permissions: [P.approve],
    fromStatuses: [S.PENDING_APPROVAL],
    targetStatus: S.DRAFT,
    tone: "danger",
    requiresReason: true,
    fourEyes: true,
  },
  {
    code: "cancelPicking",
    label: LABEL.cancelPicking,
    permissions: [P.update],
    fromStatuses: [S.PICKING],
    targetStatus: S.APPROVED,
    tone: "secondary",
  },
  {
    code: "cancel",
    label: LABEL.cancel,
    // BR-04 (docs 10 §6): chỉ huỷ trước khi rời kho nguồn; BE yêu cầu lý do
    permissions: [P.create],
    fromStatuses: [S.DRAFT, S.APPROVED],
    targetStatus: S.CANCELLED,
    tone: "danger",
    requiresReason: true,
  },
];

/**
 * Action khả dụng cho lệnh + quyền + người dùng hiện tại.
 * 1. Trạng thái thuộc `fromStatuses`.  2. Bảng chuyển trạng thái cho phép đích.  3. Đủ quyền.
 * 4. Bốn mắt: người gửi duyệt thấy nút duyệt / từ chối nhưng bị khoá kèm lý do.
 */
export function allowedTransferActions(
  transfer: TransferGateState,
  can: (code: PermissionCode) => boolean,
  currentUserId?: string,
): readonly AllowedTransferAction[] {
  return TRANSFER_ACTIONS.filter((action) => {
    const allowedByTable =
      !action.targetStatus || TRANSFER_TRANSITIONS[transfer.status].includes(action.targetStatus);
    return (
      action.fromStatuses.includes(transfer.status) &&
      allowedByTable &&
      action.permissions.every(can)
    );
  }).map((action) =>
    action.fourEyes && isOwnSubmission(transfer.submittedBy, currentUserId)
      ? { action, disabledReason: UI_LABELS.transfer.disabledReason.selfApproval }
      : { action },
  );
}

export function isOwnSubmission(
  submittedBy: string | null | undefined,
  currentUserId: string | undefined,
): boolean {
  return Boolean(submittedBy && currentUserId && submittedBy === currentUserId);
}

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

/** COMPLETED / CLOSED / CANCELLED — không còn chuyển tiếp. */
export function isTransferTerminal(status: TransferStatus): boolean {
  return TRANSFER_TRANSITIONS[status].length === 0;
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
