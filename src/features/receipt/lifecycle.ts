/**
 * Goods receipt — action-gating (feature-architecture §6).
 *
 * Bảng chuyển trạng thái dùng chung `RECEIPT_TRANSITIONS` (lib/domain, chép docs 03 §5.1).
 * Quyền: mã quyền thật đọc từ `/identity/me/permissions` (BE @RequiresPermission, PR #62).
 * UI-only — Backend phải re-check (GoodsReceipt aggregate + @RequiresPermission).
 */

import {
  GOODS_RECEIPT_PERMISSIONS,
  PO_PERMISSIONS,
  QC_TASK_PERMISSIONS,
  RECEIPT_STATUS,
  UI_LABELS,
} from "@/constants";
import { RECEIPT_TRANSITIONS } from "@/lib/domain/lifecycle";

import type { ReceiptQcProgressApi, ReceiptStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth";

const LABEL = UI_LABELS.receipt.action;

/**
 * Kiểm đếm cần dòng PO (`purchaseOrderLineId`, SL còn mở) đọc từ `GET /purchase-orders/{id}`,
 * endpoint đó đòi `procurement-purchase-orders:READ`. Seed BE (V20260903000100) KHÔNG cấp quyền
 * này cho WAREHOUSE_STAFF → NV kho không tạo / kiểm đếm được cho tới khi admin cấp thêm.
 */
export const RECEIPT_CREATE_PERMISSIONS: readonly PermissionCode[] = [
  GOODS_RECEIPT_PERMISSIONS.create,
  PO_PERMISSIONS.read,
];

/* ── Cấp phiếu ───────────────────────────────────────────────────────── */

export type ReceiptActionCode = "saveLines" | "confirm" | "cancel";

export interface ReceiptAction {
  readonly code: ReceiptActionCode;
  readonly label: string;
  /** Mọi mã quyền phải có: quyền BE guard endpoint (GoodsReceiptController) + quyền đọc dữ liệu kèm. */
  readonly permissions: readonly PermissionCode[];
  readonly fromStatuses: readonly ReceiptStatus[];
  /** Đích trong bảng chuyển trạng thái; thiếu = không đổi trạng thái (lưu kiểm đếm). */
  readonly targetStatus?: ReceiptStatus;
  readonly destructive?: boolean;
  /** BE `GoodsReceipt#confirm` từ chối phiếu chưa có dòng nào. */
  readonly requiresLines?: boolean;
}

export interface ReceiptGateState {
  status: ReceiptStatus;
  lineCount: number;
}

export interface AllowedReceiptAction {
  action: ReceiptAction;
  /** Có lý do → hiện nút nhưng khoá, kèm tooltip. */
  disabledReason?: string;
}

export const RECEIPT_ACTIONS: readonly ReceiptAction[] = [
  {
    code: "saveLines",
    label: LABEL.saveLines,
    permissions: [GOODS_RECEIPT_PERMISSIONS.update, PO_PERMISSIONS.read],
    // Chỉ DRAFT còn sửa được số; đã Confirmed thì chỉ đọc (BR-05 docs 03 §6)
    fromStatuses: [RECEIPT_STATUS.DRAFT],
  },
  {
    code: "confirm",
    label: LABEL.confirm,
    permissions: [GOODS_RECEIPT_PERMISSIONS.update],
    fromStatuses: [RECEIPT_STATUS.DRAFT],
    targetStatus: RECEIPT_STATUS.CONFIRMED,
    requiresLines: true,
  },
  {
    code: "cancel",
    label: LABEL.cancel,
    permissions: [GOODS_RECEIPT_PERMISSIONS.update],
    // BR-05 (docs 03 §6): chỉ huỷ khi chưa Confirmed; sau đó sửa bằng điều chỉnh tồn
    fromStatuses: [RECEIPT_STATUS.DRAFT],
    targetStatus: RECEIPT_STATUS.CANCELLED,
    destructive: true,
  },
];

/**
 * Action khả dụng cho phiếu + quyền người dùng (`can` từ `usePermissionChecker`).
 * 1. Trạng thái thuộc `fromStatuses`.  2. Bảng chuyển trạng thái cho phép đích.  3. Có quyền.
 */
export function allowedReceiptActions(
  receipt: ReceiptGateState,
  can: (code: PermissionCode) => boolean,
): readonly AllowedReceiptAction[] {
  return RECEIPT_ACTIONS.filter((action) => {
    const allowedByTable =
      !action.targetStatus || RECEIPT_TRANSITIONS[receipt.status].includes(action.targetStatus);
    return (
      action.fromStatuses.includes(receipt.status) &&
      allowedByTable &&
      action.permissions.every(can)
    );
  }).map((action) =>
    action.requiresLines && receipt.lineCount === 0
      ? { action, disabledReason: UI_LABELS.receipt.disabledReason.noLines }
      : { action },
  );
}

/** Chỉ DRAFT sửa được; phiếu đã xác nhận ("posted") chỉ đọc. */
export function isReceiptEditable(status: ReceiptStatus): boolean {
  return status === RECEIPT_STATUS.DRAFT;
}

/** Closed / Cancelled — không còn chuyển tiếp, ẩn mọi nút thao tác. */
export function isReceiptTerminal(status: ReceiptStatus): boolean {
  return RECEIPT_TRANSITIONS[status].length === 0;
}

/* ── Cấp dòng (luồng 3 bước, docs 03 §4 chặng 2) ─────────────────────── */

export type ReceiptLineActionCode = "moveToQc" | "inspect";

export interface ReceiptLineAction {
  readonly code: ReceiptLineActionCode;
  readonly label: string;
  readonly permission: PermissionCode;
  /** Tiến độ QC của dòng mà action áp dụng được. */
  readonly fromProgress: ReceiptQcProgressApi;
}

export const RECEIPT_LINE_ACTIONS: readonly ReceiptLineAction[] = [
  {
    code: "moveToQc",
    label: LABEL.moveToQc,
    // NV kho chuyển hàng RECEIVING → QUALITY_CONTROL (docs 03 bước 7)
    permission: GOODS_RECEIPT_PERMISSIONS.update,
    fromProgress: "AWAITING_MOVE_TO_QC",
  },
  {
    code: "inspect",
    label: LABEL.inspect,
    // BR-08 (docs 03 §6): chỉ kết luận hàng ĐÃ ở khu QC; quyền của NV QC, không phải NV kho
    permission: QC_TASK_PERMISSIONS.approve,
    fromProgress: "IN_QC_AREA",
  },
];

/** Action cho một dòng: phiếu phải đang `In QC` và dòng đúng chặng. */
export function allowedLineActions(
  receiptStatus: ReceiptStatus,
  line: { qcProgress: ReceiptQcProgressApi },
  can: (code: PermissionCode) => boolean,
): readonly ReceiptLineAction[] {
  if (receiptStatus !== RECEIPT_STATUS.IN_QC) return [];
  return RECEIPT_LINE_ACTIONS.filter(
    (action) => action.fromProgress === line.qcProgress && can(action.permission),
  );
}
