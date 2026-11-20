/**
 * Goods receipt — action-gating (feature-architecture §6).
 *
 * Bảng chuyển trạng thái dùng chung `RECEIPT_TRANSITIONS` (lib/domain, chép docs 03 §5).
 * Quyền: mã quyền thật đọc từ `/identity/me/permissions` (BE @RequiresPermission).
 * UI-only — Backend phải re-check (GoodsReceipt aggregate + @RequiresPermission).
 */

import {
  GOODS_RECEIPT_PERMISSIONS,
  PRODUCTION_ORDER_PERMISSIONS,
  RECEIPT_COUNT_LABELS,
  RECEIPT_STATUS,
  RECEIPT_TYPE,
  UI_LABELS,
} from "@/constants";
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
  /** Form kiểm đếm còn thay đổi chưa lưu — xác nhận lúc này sẽ chốt bản đếm cũ. */
  countDirty?: boolean;
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
  ).map((action) => {
    if (action.requiresLines && receipt.lineCount === 0)
      return { action, disabledReason: UI_LABELS.receipt.disabledReason.noLines };
    if (action.code === "confirm" && receipt.countDirty)
      return { action, disabledReason: RECEIPT_COUNT_LABELS.count.dirtyBlocksConfirm };
    return { action };
  });
}

/** Kết quả gate của một thao tác: `null` = không hiện; có `disabledReason` = hiện nhưng khoá kèm lý do. */
export type ReceiptGate = { disabledReason?: string } | null;

/**
 * Lập phiếu theo Đơn sản xuất (docs 03 §4.1 bước 1): cần `goods-receipts:CREATE`, và `production-orders:READ` để
 * chọn Đơn sản xuất. Seed BE chưa cấp quyền đọc Đơn sản xuất cho NV kho → hiện nút khoá kèm lý do, không ẩn.
 * UI-only — Backend phải re-check (BR-01, BR-15).
 */
export function productionReceiptCreateGate(can: (code: PermissionCode) => boolean): ReceiptGate {
  if (!can(GOODS_RECEIPT_PERMISSIONS.create)) return null;
  return can(PRODUCTION_ORDER_PERMISSIONS.read)
    ? {}
    : { disabledReason: RECEIPT_COUNT_LABELS.noProductionRead };
}

/**
 * Kiểm đếm theo thùng (docs 03 §4.1 bước 2–5): chỉ phiếu theo Đơn sản xuất còn `Draft`, cần `goods-receipts:UPDATE`;
 * dòng cần đếm lấy từ Đơn sản xuất nên cần thêm `production-orders:READ`. UI-only — Backend phải re-check (BR-02).
 */
export function receiptCountGate(
  receipt: Pick<ReceiptGateState, "status" | "receiptType">,
  can: (code: PermissionCode) => boolean,
): ReceiptGate {
  if (receipt.receiptType !== RECEIPT_TYPE.PRODUCTION) return null;
  if (receipt.status !== RECEIPT_STATUS.DRAFT) return null;
  if (!can(GOODS_RECEIPT_PERMISSIONS.update)) return null;
  return can(PRODUCTION_ORDER_PERMISSIONS.read)
    ? {}
    : { disabledReason: RECEIPT_COUNT_LABELS.noProductionRead };
}

/** Closed / Cancelled (và mã cũ Pending Approval) — không còn chuyển tiếp, ẩn mọi nút thao tác. */
export function isReceiptTerminal(status: ReceiptStatus): boolean {
  return RECEIPT_TRANSITIONS[status].length === 0;
}
