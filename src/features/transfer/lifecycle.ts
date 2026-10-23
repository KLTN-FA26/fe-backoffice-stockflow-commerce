/**
 * Transfer order — action-gating (feature-architecture §6).
 *
 * Bảng chuyển trạng thái `TRANSFER_TRANSITIONS` (lib/domain, = docs 10 §5 = BE TransferStatus).
 * Quyền: mã thật từ `/identity/me/permissions` theo `@RequiresPermission` của TransferOrderController.
 * UI-only — Backend phải re-check (TransferOrderServiceImpl + @RequiresPermission + phạm vi kho BR-SEC-002).
 */

import { TRANSFER_PERMISSIONS, TRANSFER_STATUS, UI_LABELS } from "@/constants";
import { TRANSFER_TRANSITIONS } from "@/lib/domain/lifecycle";

import { FTL_TRANSFER_ACTIONS, isFtl, withoutRedundantViewPacking } from "./ftl-lifecycle";

import type { DeliveryMode, TransferStatus } from "@/constants";
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
  | "cancel"
  // SCRUM-287 PR F9: lệnh nguyên chuyến (FTL) — chuyển sang trạm đóng gói / màn lập kế hoạch xe
  | "packTransfer"
  | "viewPacking"
  | "planVehicle";

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
  /** Điều kiện thêm ngoài trạng thái + quyền (hình thức giao, đã đóng gói, đã có hàng rời kho). */
  readonly when?: (transfer: TransferGateState) => boolean;
  /** Hiện nút nhưng khoá kèm lý do (khác với `when`: ẩn hẳn). */
  readonly lockedReason?: (transfer: TransferGateState) => string | undefined;
}

export interface TransferGateState {
  status: TransferStatus;
  submittedBy?: string | null;
  /** LP2-8: nguyên chuyến (FTL, mặc định) hay giao lẻ — quyết định đóng gói / kế hoạch xe / xuất kho thủ công. */
  deliveryMode: DeliveryMode;
  /** Đóng gói xong (sẵn sàng lập kế hoạch xe). */
  packedAt?: string | null;
  /** BR-04 (docs 10): chiếc xe đầu tiên đã được ký nhận — hàng đã rời kho nguồn. */
  goodsLeftAt?: string | null;
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
    // BE 409 TRANSFER_DISPATCH_BY_LOAD_PLAN: lệnh nguyên chuyến do xe cuối của kế hoạch xe xuất, không xuất thủ công
    when: (transfer) => !isFtl(transfer),
  },
  ...FTL_TRANSFER_ACTIONS,
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
    // BE 409 TRANSFER_GOODS_LEFT (docs 10 BR-04): xe đầu đã ký nhận thì không dừng lấy hàng nữa
    lockedReason: (transfer) =>
      transfer.goodsLeftAt
        ? UI_LABELS.transfer.deliveryMode.goodsLeftCannotCancelPicking
        : undefined,
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
      action.permissions.every(can) &&
      (action.when?.(transfer) ?? true)
    );
  })
    .filter(withoutRedundantViewPacking)
    .map((action) => {
      const reason =
        action.fourEyes && isOwnSubmission(transfer.submittedBy, currentUserId)
          ? UI_LABELS.transfer.disabledReason.selfApproval
          : action.lockedReason?.(transfer);
      return reason ? { action, disabledReason: reason } : { action };
    });
}

export function isOwnSubmission(
  submittedBy: string | null | undefined,
  currentUserId: string | undefined,
): boolean {
  return Boolean(submittedBy && currentUserId && submittedBy === currentUserId);
}

export {
  TRANSFER_NO_ACTION_REASON,
  isTransferDispatched,
  isTransferEditable,
  isTransferInTransit,
} from "./status-helpers";
export { dispatchExplanation, nextStepHint } from "./ftl-lifecycle";
