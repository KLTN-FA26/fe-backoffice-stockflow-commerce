/**
 * Purchase Order — lifecycle & action-gating.
 *
 * Quyền: mã quyền thật `procurement-purchase-orders:*` đọc từ `/identity/me/permissions`
 * (BE #39) — KHÔNG gắn cứng theo tên vai trò.
 * UI-only — Backend phải re-check (@RequiresPermission + 409 INVALID_PURCHASE_ORDER_TRANSITION).
 */

import {
  GOODS_RECEIPT_PERMISSIONS,
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
 * docs 02-purchase-order §5 — bảng "Chuyển tiếp cho phép", thu hẹp theo BE
 * `PurchaseOrderStatus#canTransitionTo` (SCRUM-113/116). Đặt trong feature (không dùng bảng
 * Title Case của `lib/domain/lifecycle.ts`) vì PO đã chạy theo 7 mã trạng thái BE. Ánh xạ:
 *   Draft → Pending Approval / Approved   ⇒ DRAFT → APPROVED (BE gộp submit+approve)
 *   Approved → Confirmed                  ⇒ APPROVED → SENT
 *   Confirmed / Partially Received → Received → Closed ⇒ do phiếu nhận ghi tiến độ khi xác nhận
 *     (POST /goods-receipts/{id}/confirmation, BE PR #62), không qua bảng này — xem action "receive"
 *   Partially Received → Closed (short-close) ⇒ PARTIALLY_RECEIVED → CLOSED_SHORT
 * ASSUMPTION (open-question A2): BE chưa có Pending Approval / hạn mức duyệt (BR-PO-002).
 */
export const PO_TRANSITIONS: Readonly<Record<PoStatus, readonly PoStatus[]>> = {
  DRAFT: [PO_STATUS.APPROVED, PO_STATUS.CANCELLED],
  APPROVED: [PO_STATUS.SENT, PO_STATUS.CANCELLED],
  // BR-05 (docs 02 §6): chỉ huỷ được khi CHƯA nhận hàng — SENT chưa có receipt nào.
  SENT: [PO_STATUS.CANCELLED],
  // BR-05 (docs 02 §6): đã nhận một phần ⇒ không còn CANCELLED, chỉ short-close.
  PARTIALLY_RECEIVED: [PO_STATUS.CLOSED_SHORT],
  CLOSED: [], // terminal
  CLOSED_SHORT: [], // terminal
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
  | "approve"
  | "send"
  | "cancel"
  | "closeShort"
  | "receive"
  | "recoverDelivery"
  | "recordConfirmation";

export interface PoAction {
  readonly code: PoActionCode;
  readonly label: string;
  /** Mã quyền BE guard endpoint này (PurchaseOrderController @RequiresPermission). */
  readonly permission: PermissionCode;
  /** Quyền phải có thêm khi action mở sang màn khác (vd quyền mở trang đích). */
  readonly extraPermissions?: readonly PermissionCode[];
  readonly fromStatuses: readonly PoStatus[];
  /** Trạng thái đích nếu là chuyển một bước (receive/khôi phục/xác nhận không có). */
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
    code: "approve",
    label: UI_LABELS.purchaseOrder.action.approve,
    permission: PO_PERMISSIONS.approve,
    fromStatuses: [PO_STATUS.DRAFT],
    targetStatus: PO_STATUS.APPROVED,
  },
  {
    code: "send",
    label: UI_LABELS.purchaseOrder.action.send,
    permission: PO_PERMISSIONS.update,
    fromStatuses: [PO_STATUS.APPROVED],
    targetStatus: PO_STATUS.SENT,
  },
  {
    code: "receive",
    label: UI_LABELS.purchaseOrder.action.receive,
    // SCRUM-436: "Nhận hàng" mở màn tạo phiếu nhận (POST /goods-receipts, BE PR #62) — quyền của
    // phiếu nhận, không phải PO:UPDATE. Màn PO đã cần purchase-orders:READ.
    permission: GOODS_RECEIPT_PERMISSIONS.create,
    // Màn tạo phiếu nhận gate thêm VIEW_PAGE — thiếu thì bấm vào sẽ bị chặn trang
    extraPermissions: [GOODS_RECEIPT_PERMISSIONS.viewPage],
    // BR-03 (docs 02 §6): chỉ nhận khi PO đã chốt (Confirmed ≙ BE SENT) hoặc Partially Received.
    fromStatuses: [PO_STATUS.SENT, PO_STATUS.PARTIALLY_RECEIVED],
    // NCC đã từ chối thì không nhận — huỷ và tạo PO thay thế. Bảng PO mới (C4) chỉ CONFIRMED khi
    // NCC đã xác nhận, nên BE receipt cũng trả PURCHASE_ORDER_NOT_RECEIVABLE (BR-01 docs 03).
    when: (po) => po.supplierConfirmationStatus !== SUPPLIER_CONFIRMATION_STATUS.REJECTED,
  },
  {
    code: "recordConfirmation",
    label: UI_LABELS.purchaseOrder.action.recordConfirmation,
    permission: PO_PERMISSIONS.update,
    fromStatuses: [
      PO_STATUS.SENT,
      PO_STATUS.PARTIALLY_RECEIVED,
      PO_STATUS.CLOSED,
      PO_STATUS.CLOSED_SHORT,
    ],
    // BE recordSupplierConfirmation: chỉ khi đang chờ NCC phản hồi.
    when: (po) => po.supplierConfirmationStatus === SUPPLIER_CONFIRMATION_STATUS.PENDING,
  },
  {
    code: "recoverDelivery",
    label: UI_LABELS.purchaseOrder.action.recoverDelivery,
    permission: PO_PERMISSIONS.approve,
    fromStatuses: [PO_STATUS.SENT],
    // BE requireDeliveryRecovery: SENT + chờ NCC phản hồi + lần gửi cuối thất bại hẳn.
    when: (po) =>
      po.supplierConfirmationStatus === SUPPLIER_CONFIRMATION_STATUS.PENDING &&
      po.deliveryStatus === PO_DELIVERY_STATUS.FAILED,
  },
  {
    code: "closeShort",
    label: UI_LABELS.purchaseOrder.action.closeShort,
    permission: PO_PERMISSIONS.update,
    fromStatuses: [PO_STATUS.PARTIALLY_RECEIVED],
    targetStatus: PO_STATUS.CLOSED_SHORT,
    destructive: true,
  },
  {
    code: "cancel",
    label: UI_LABELS.purchaseOrder.action.cancel,
    permission: PO_PERMISSIONS.update,
    // BR-05 (docs 02 §6): không huỷ khi đã có receipt — PARTIALLY_RECEIVED bị loại.
    fromStatuses: [PO_STATUS.DRAFT, PO_STATUS.APPROVED, PO_STATUS.SENT],
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
      can(action.permission) &&
      (action.extraPermissions ?? []).every(can)
    );
  });
}

/** Không còn chuyển tiếp (CLOSED / CLOSED_SHORT / CANCELLED). */
export function isPoTerminal(status: string): boolean {
  return (nextOf(status) ?? []).length === 0;
}

/** Trạng thái kế tiếp một bước từ `status`. */
export function nextPoStatuses(status: string): readonly PoStatus[] {
  return nextOf(status) ?? [];
}
