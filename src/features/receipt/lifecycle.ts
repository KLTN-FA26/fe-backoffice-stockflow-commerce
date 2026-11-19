/**
 * Goods receipt — action-gating (feature-architecture §6).
 *
 * Bảng chuyển trạng thái dùng chung `RECEIPT_TRANSITIONS` (lib/domain, chép docs 03 §5).
 * Quyền: mã quyền thật đọc từ `/identity/me/permissions` (BE @RequiresPermission).
 * UI-only — Backend phải re-check (GoodsReceipt aggregate + @RequiresPermission).
 */

import { GOODS_RECEIPT_PERMISSIONS, RECEIPT_STATUS, RECEIPT_TYPE, UI_LABELS } from "@/constants";
import { RECEIPT_TRANSITIONS } from "@/lib/domain/lifecycle";

import type { ReceiptStatus, ReceiptTypeApi } from "@/constants";
import type { PermissionCode } from "@/lib/auth";

const LABEL = UI_LABELS.receipt.action;

export type ReceiptActionCode = "confirm" | "cancel";

export interface ReceiptAction {
  readonly code: ReceiptActionCode;
  readonly label: string;
  /** Mọi mã quyền phải có (quyền BE guard endpoint GoodsReceiptController). */
  readonly permissions: readonly PermissionCode[];
  readonly fromStatuses: readonly ReceiptStatus[];
  readonly targetStatus: ReceiptStatus;
  readonly destructive?: boolean;
  /** BE `GoodsReceipt#confirm` từ chối phiếu chưa có dòng nào. */
  readonly requiresLines?: boolean;
  /** Loại phiếu mà action áp dụng; thiếu = mọi loại. */
  readonly receiptTypes?: readonly ReceiptTypeApi[];
}

export interface ReceiptGateState {
  status: ReceiptStatus;
  lineCount: number;
  receiptType: ReceiptTypeApi;
}

export interface AllowedReceiptAction {
  action: ReceiptAction;
  /** Có lý do → hiện nút nhưng khoá, kèm tooltip. */
  disabledReason?: string;
}

export const RECEIPT_ACTIONS: readonly ReceiptAction[] = [
  {
    // Docs 03 §4.1 bước 6–7: xác nhận → tồn Inbound, Đơn sản xuất cập nhật, phiếu sang In Putaway.
    // BE 4A-8: phiếu mua hàng cũ không xác nhận được nữa (`INVALID_RECEIPT_TRANSITION`) — chỉ phiếu theo Đơn SX.
    code: "confirm",
    label: LABEL.confirm,
    permissions: [GOODS_RECEIPT_PERMISSIONS.update],
    fromStatuses: [RECEIPT_STATUS.DRAFT],
    targetStatus: RECEIPT_STATUS.CONFIRMED,
    requiresLines: true,
    receiptTypes: [RECEIPT_TYPE.PRODUCTION],
  },
  {
    // BR-05 (docs 03 §6): chỉ phiếu Draft được huỷ; đã xác nhận thì sửa bằng điều chỉnh tồn có duyệt
    code: "cancel",
    label: LABEL.cancel,
    permissions: [GOODS_RECEIPT_PERMISSIONS.update],
    fromStatuses: [RECEIPT_STATUS.DRAFT],
    targetStatus: RECEIPT_STATUS.CANCELLED,
    destructive: true,
    // Phiếu hàng hoàn huỷ qua luồng riêng (`features/return`, `/goods-receipts/returns`) — không huỷ ở màn này
    receiptTypes: [RECEIPT_TYPE.PRODUCTION, RECEIPT_TYPE.PURCHASE],
  },
];

/**
 * Action khả dụng cho phiếu + quyền người dùng (`can` từ `usePermissionChecker`).
 * 1. Đúng loại phiếu.  2. Trạng thái thuộc `fromStatuses`.  3. Bảng chuyển trạng thái cho phép đích.  4. Có quyền.
 */
export function allowedReceiptActions(
  receipt: ReceiptGateState,
  can: (code: PermissionCode) => boolean,
): readonly AllowedReceiptAction[] {
  return RECEIPT_ACTIONS.filter(
    (action) =>
      (!action.receiptTypes || action.receiptTypes.includes(receipt.receiptType)) &&
      action.fromStatuses.includes(receipt.status) &&
      RECEIPT_TRANSITIONS[receipt.status].includes(action.targetStatus) &&
      action.permissions.every(can),
  ).map((action) =>
    action.requiresLines && receipt.lineCount === 0
      ? { action, disabledReason: UI_LABELS.receipt.disabledReason.noLines }
      : { action },
  );
}

/** Closed / Cancelled (và mã cũ Pending Approval) — không còn chuyển tiếp, ẩn mọi nút thao tác. */
export function isReceiptTerminal(status: ReceiptStatus): boolean {
  return RECEIPT_TRANSITIONS[status].length === 0;
}
