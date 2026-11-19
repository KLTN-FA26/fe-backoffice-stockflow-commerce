/**
 * Vòng đời Đơn sản xuất — chép bảng "Chuyển tiếp cho phép" của kltn-docs 17 §5.3 (khớp BE
 * `ProductionOrderStatus.next()`), và nút nào hiện theo trạng thái + mã quyền + người dùng.
 * UI-only — Backend phải re-check (`@RequiresPermission` production-orders, BR-06, BR-23, BR-24).
 */

import { PRODUCTION_ORDER_PERMISSIONS } from "@/constants";

import type { ProducerChannel, ProductionOrderStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth";
import type { ProductionOrder } from "./types";

/** Docs 17 §5.3. Terminal (`Received`, `Cancelled`, `Closed`) không có chuyển tiếp nào. */
export const PRODUCTION_ORDER_TRANSITIONS = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["SENT", "DRAFT", "CANCELLED"],
  SENT: ["ACCEPTED", "IN_PRODUCTION", "CANCELLED"],
  ACCEPTED: ["SAMPLE_PENDING", "IN_PRODUCTION", "CANCELLED"],
  SAMPLE_PENDING: ["IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["PARTIALLY_RECEIVED", "RECEIVED", "CLOSED"],
  PARTIALLY_RECEIVED: ["RECEIVED", "CLOSED"],
  RECEIVED: [],
  CANCELLED: [],
  CLOSED: [],
} as const satisfies Record<ProductionOrderStatus, readonly ProductionOrderStatus[]>;

export const canTransition = (from: ProductionOrderStatus, to: ProductionOrderStatus): boolean =>
  (PRODUCTION_ORDER_TRANSITIONS[from] as readonly ProductionOrderStatus[]).includes(to);

export const isTerminal = (status: ProductionOrderStatus): boolean =>
  PRODUCTION_ORDER_TRANSITIONS[status].length === 0;

/** Từ khi đơn vị sản xuất nhận đơn tới khi nhập đủ: ngày dự kiến còn có nghĩa (docs 17 §4.3 bước 8–11). */
const EXPECTED_DATE_STATUSES: readonly ProductionOrderStatus[] = [
  "ACCEPTED",
  "SAMPLE_PENDING",
  "IN_PRODUCTION",
  "PARTIALLY_RECEIVED",
];

/** Đã gửi và còn mở: gửi lại mail cho đơn vị sản xuất được (BE `ProductionOrderDispatch#resend`). */
const RESENDABLE_STATUSES: readonly ProductionOrderStatus[] = ["SENT", ...EXPECTED_DATE_STATUSES];

export interface ProductionOrderActor {
  can: (code: PermissionCode) => boolean;
  /** Người đang đăng nhập — BR-23: người duyệt ≠ người lập. */
  userId: string | null | undefined;
}

export interface ProductionOrderActions {
  edit: boolean;
  submit: boolean;
  approve: boolean;
  return: boolean;
  accept: boolean;
  changeExpected: boolean;
  startProduction: boolean;
  cancel: boolean;
  close: boolean;
  resend: boolean;
  /** Có quyền duyệt nhưng chính mình lập → không hiện nút, hiện lời giải thích (BR-23). */
  selfApprovalBlocked: boolean;
  /** ACCEPTED nhưng cần duyệt mẫu → không có "Bắt đầu sản xuất"; khách duyệt mẫu mới chuyển (BR-24). */
  startBlockedBySample: boolean;
}

export const NO_PRODUCTION_ORDER_ACTIONS: ProductionOrderActions = {
  edit: false,
  submit: false,
  approve: false,
  return: false,
  accept: false,
  changeExpected: false,
  startProduction: false,
  cancel: false,
  close: false,
  resend: false,
  selfApprovalBlocked: false,
  startBlockedBySample: false,
};

type Subject = Pick<ProductionOrder, "status" | "drawnUpBy" | "sampleApprovalRequired">;

/**
 * Nút thao tác theo docs 17 §5.3 + brief BE §3.2. `channel` (từ `/dispatch`) chỉ cần cho "Gửi lại mail": kênh PDF thì
 * Điều phối sản xuất tự giao phiếu, không có mail để gửi lại.
 */
export function productionOrderActions(
  order: Subject,
  actor: ProductionOrderActor,
  channel?: ProducerChannel | null,
): ProductionOrderActions {
  const { status } = order;
  const update = actor.can(PRODUCTION_ORDER_PERMISSIONS.update);
  const approver = actor.can(PRODUCTION_ORDER_PERMISSIONS.approve);
  const pending = status === "PENDING_APPROVAL";
  // BR-23 (docs 17 §6): người duyệt ≠ người lập — Backend phải re-check (409 PRODUCTION_ORDER_SELF_APPROVAL)
  const isAuthor = Boolean(actor.userId) && actor.userId === order.drawnUpBy;
  const canDecide = pending && approver && !isAuthor;
  // Docs 17 §5.3: Sent → In Production chỉ do hệ thống khi hàng về (không cần duyệt mẫu); người dùng chỉ bắt đầu sản
  // xuất từ Accepted (BE `POST /production-start` — "an ACCEPTED production order", 409 PRODUCTION_ORDER_SAMPLE_REQUIRED)
  const startable = status === "ACCEPTED" && canTransition(status, "IN_PRODUCTION");
  return {
    edit: update && status === "DRAFT",
    submit: update && canTransition(status, "PENDING_APPROVAL"),
    approve: canDecide,
    return: canDecide && canTransition(status, "DRAFT"),
    accept: update && canTransition(status, "ACCEPTED"),
    changeExpected: update && EXPECTED_DATE_STATUSES.includes(status),
    // BR-24 (docs 17 §6): có cờ duyệt mẫu thì chỉ khách duyệt mẫu mới sang In Production
    startProduction: update && startable && !order.sampleApprovalRequired,
    // BR-06 (docs 17 §6): huỷ chỉ trước khi in hàng loạt; đóng chỉ từ In Production / Partially Received
    cancel: update && canTransition(status, "CANCELLED"),
    close: update && canTransition(status, "CLOSED"),
    resend: update && channel === "EMAIL" && RESENDABLE_STATUSES.includes(status),
    selfApprovalBlocked: pending && approver && isAuthor,
    startBlockedBySample: update && startable && order.sampleApprovalRequired,
  };
}

/** Có nút ghi nào không — terminal thì luôn không (docs 17 §5.3). */
export const hasMutatingAction = (actions: ProductionOrderActions): boolean =>
  Object.entries(actions).some(
    ([key, value]) => value && key !== "selfApprovalBlocked" && key !== "startBlockedBySample",
  );
