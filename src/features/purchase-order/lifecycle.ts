/**
 * Purchase Order — lifecycle & action-gating.
 *
 * Quyền: mã quyền thật `procurement-purchase-orders:*` đọc từ `/identity/me/permissions`
 * (BE #39) — KHÔNG gắn cứng theo tên vai trò.
 * UI-only — Backend phải re-check (@RequiresPermission + 409 INVALID_PURCHASE_ORDER_TRANSITION).
 */

import {
  PO_DELIVERY_STATUS,
  PO_PERMISSIONS,
  PO_STATUS,
  PO_STATUSES,
  SUPPLIER_CONFIRMATION_STATUS,
  UI_LABELS,
} from "@/constants";

import type { PermissionCode } from "@/lib/auth";
import type { PoStatus, PurchaseOrder } from "./types";

/**
 * docs 02-purchase-order §5 — bảng "Chuyển tiếp cho phép", đúng BE `PurchaseOrderStatus#canTransitionTo`
 * (quyết định D4, BE PR #71):
 *   DRAFT → PENDING_APPROVAL (gửi duyệt) → APPROVED (duyệt 4 mắt, BR-PO-002) | DRAFT (từ chối)
 *   APPROVED → CONFIRMED (chốt = gửi NCC)
 *   CONFIRMED / PARTIALLY_RECEIVED → … → RECEIVED: do phiếu nhận hàng (`/goods-receipts`), không qua bảng này
 *   PARTIALLY_RECEIVED → CLOSED (đóng thiếu) · RECEIVED → CLOSED (đóng đơn)
 *   DRAFT / PENDING_APPROVAL / APPROVED / CONFIRMED → CANCELLED (BR-05: chưa nhận hàng)
 */
export const PO_TRANSITIONS: Readonly<Record<PoStatus, readonly PoStatus[]>> = {
  DRAFT: [PO_STATUS.PENDING_APPROVAL, PO_STATUS.CANCELLED],
  PENDING_APPROVAL: [PO_STATUS.APPROVED, PO_STATUS.DRAFT, PO_STATUS.CANCELLED],
  APPROVED: [PO_STATUS.CONFIRMED, PO_STATUS.CANCELLED],
  // BR-05 (docs 02 §6): chỉ huỷ được khi CHƯA nhận hàng.
  CONFIRMED: [PO_STATUS.CANCELLED],
  // BR-05 (docs 02 §6): đã nhận một phần ⇒ không còn CANCELLED, chỉ đóng thiếu.
  PARTIALLY_RECEIVED: [PO_STATUS.CLOSED],
  RECEIVED: [PO_STATUS.CLOSED],
  CLOSED: [], // terminal
  CANCELLED: [], // terminal
};

/**
 * Trạng thái kế tiếp; `undefined` nếu `status` nằm ngoài bảng. Status đã qua zod nên lẽ ra không
 * xảy ra — guard chỉ để một giá trị lạ hiện "không có thao tác" thay vì sập trang
 * (`undefined.length`, regression khoá trong lifecycle.test.ts).
 */
function nextOf(status: string): readonly PoStatus[] | undefined {
  return isPoStatus(status) ? PO_TRANSITIONS[status] : undefined;
}

function isPoStatus(value: string): value is PoStatus {
  return (PO_STATUSES as readonly string[]).includes(value);
}

export type PoActionCode =
  | "submit"
  | "approve"
  | "reject"
  | "send"
  | "cancel"
  | "closeShort"
  | "close"
  | "recoverDelivery"
  | "recordConfirmation";

export interface PoAction {
  readonly code: PoActionCode;
  readonly label: string;
  /** Mã quyền BE guard endpoint này (PurchaseOrderController @RequiresPermission). */
  readonly permission: PermissionCode;
  readonly fromStatuses: readonly PoStatus[];
  /** Trạng thái đích nếu là chuyển một bước (khôi phục/xác nhận NCC không có). */
  readonly targetStatus?: PoStatus;
  /** Điều kiện ngoài trạng thái PO (giao NCC / NCC phản hồi) — đúng domain rule BE. */
  readonly when?: (po: PoGateState) => boolean;
  readonly destructive?: boolean;
}

export type PoGateState = Pick<
  PurchaseOrder,
  "status" | "supplierConfirmationStatus" | "deliveryStatus"
>;

export const PO_ACTIONS: readonly PoAction[] = [
  {
    code: "submit",
    label: UI_LABELS.purchaseOrder.action.submit,
    permission: PO_PERMISSIONS.update,
    fromStatuses: [PO_STATUS.DRAFT],
    targetStatus: PO_STATUS.PENDING_APPROVAL,
  },
  {
    code: "approve",
    label: UI_LABELS.purchaseOrder.action.approve,
    permission: PO_PERMISSIONS.approve,
    // BR-PO-002 (docs 02 §6): người duyệt khác người gửi — BE trả 409 SELF_APPROVAL_NOT_ALLOWED.
    fromStatuses: [PO_STATUS.PENDING_APPROVAL],
    targetStatus: PO_STATUS.APPROVED,
  },
  {
    code: "reject",
    label: UI_LABELS.purchaseOrder.action.reject,
    permission: PO_PERMISSIONS.approve,
    fromStatuses: [PO_STATUS.PENDING_APPROVAL],
    targetStatus: PO_STATUS.DRAFT,
    destructive: true,
  },
  {
    code: "send",
    label: UI_LABELS.purchaseOrder.action.send,
    permission: PO_PERMISSIONS.update,
    fromStatuses: [PO_STATUS.APPROVED],
    targetStatus: PO_STATUS.CONFIRMED,
  },
  {
    code: "recordConfirmation",
    label: UI_LABELS.purchaseOrder.action.recordConfirmation,
    permission: PO_PERMISSIONS.update,
    fromStatuses: [
      PO_STATUS.CONFIRMED,
      PO_STATUS.PARTIALLY_RECEIVED,
      PO_STATUS.RECEIVED,
      PO_STATUS.CLOSED,
    ],
    // BE recordSupplierConfirmation: chỉ khi đang chờ NCC phản hồi.
    when: (po) => po.supplierConfirmationStatus === SUPPLIER_CONFIRMATION_STATUS.PENDING,
  },
  {
    code: "recoverDelivery",
    label: UI_LABELS.purchaseOrder.action.recoverDelivery,
    permission: PO_PERMISSIONS.approve,
    fromStatuses: [PO_STATUS.CONFIRMED],
    // BE requireDeliveryRecovery: CONFIRMED + chờ NCC phản hồi + lần gửi cuối thất bại hẳn.
    when: (po) =>
      po.supplierConfirmationStatus === SUPPLIER_CONFIRMATION_STATUS.PENDING &&
      po.deliveryStatus === PO_DELIVERY_STATUS.FAILED,
  },
  {
    code: "closeShort",
    label: UI_LABELS.purchaseOrder.action.closeShort,
    permission: PO_PERMISSIONS.update,
    fromStatuses: [PO_STATUS.PARTIALLY_RECEIVED],
    targetStatus: PO_STATUS.CLOSED,
    destructive: true,
  },
  {
    code: "close",
    label: UI_LABELS.purchaseOrder.action.close,
    permission: PO_PERMISSIONS.update,
    fromStatuses: [PO_STATUS.RECEIVED],
    targetStatus: PO_STATUS.CLOSED,
  },
  {
    code: "cancel",
    label: UI_LABELS.purchaseOrder.action.cancel,
    permission: PO_PERMISSIONS.update,
    // BR-05 (docs 02 §6): không huỷ khi đã có phiếu nhận — PARTIALLY_RECEIVED bị loại.
    fromStatuses: [
      PO_STATUS.DRAFT,
      PO_STATUS.PENDING_APPROVAL,
      PO_STATUS.APPROVED,
      PO_STATUS.CONFIRMED,
    ],
    targetStatus: PO_STATUS.CANCELLED,
    destructive: true,
  },
];

/**
 * Action khả dụng cho PO hiện tại + bộ quyền của người dùng (`can` từ `usePermissionChecker`).
 * 1. Trạng thái nằm trong `fromStatuses`.  2. Bảng chuyển trạng thái cho phép (nếu có đích).
 * 3. Điều kiện giao NCC / NCC phản hồi.  4. Có mã quyền BE guard endpoint đó.
 */
export function allowedPoActions(
  po: PoGateState,
  can: (code: PermissionCode) => boolean,
): readonly PoAction[] {
  return PO_ACTIONS.filter((action) => {
    const allowedByTable =
      !action.targetStatus || (nextOf(po.status)?.includes(action.targetStatus) ?? false);
    return (
      action.fromStatuses.includes(po.status) &&
      allowedByTable &&
      (action.when?.(po) ?? true) &&
      can(action.permission)
    );
  });
}

/** Không còn chuyển tiếp (CLOSED / CANCELLED). */
export function isPoTerminal(status: string): boolean {
  return (nextOf(status) ?? []).length === 0;
}

/** Trạng thái kế tiếp một bước từ `status`. */
export function nextPoStatuses(status: string): readonly PoStatus[] {
  return nextOf(status) ?? [];
}
