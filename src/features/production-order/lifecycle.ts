/**
 * Vòng đời Đơn sản xuất — chép bảng "Chuyển tiếp cho phép" của kltn-docs 17 §5.3 (khớp BE
 * `ProductionOrderStatus.next()`), và nút nào hiện theo trạng thái + mã quyền.
 * UI-only — Backend phải re-check (`@RequiresPermission` production-orders, BR-06, BR-23, BR-24).
 */

import { PRODUCTION_ORDER_PERMISSIONS } from "@/constants";

import type { ProducerChannel, ProductionOrderStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth";
import type { ProductionOrder } from "./types";

/**
 * Docs 17 §5.3. Terminal (`Received`, `Cancelled`, `Closed`) không có chuyển tiếp nào.
 * BR-23 (docs 17 §6, chốt lại 2026-11-20): bỏ bước duyệt — Điều phối sản xuất gửi thẳng `Draft` → `Sent`.
 * `Pending Approval` chỉ còn trong lịch sử: không chuyển vào, không chuyển ra (BE V20261211000100 đưa đơn đang chờ về
 * `Draft`).
 */
export const PRODUCTION_ORDER_TRANSITIONS = {
  DRAFT: ["SENT", "CANCELLED"],
  PENDING_APPROVAL: [],
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
}

export interface ProductionOrderActions {
  edit: boolean;
  send: boolean;
  accept: boolean;
  changeExpected: boolean;
  startProduction: boolean;
  cancel: boolean;
  close: boolean;
  resend: boolean;
  /** ACCEPTED nhưng cần duyệt mẫu → không có "Bắt đầu sản xuất"; khách duyệt mẫu mới chuyển (BR-24). */
  startBlockedBySample: boolean;
}

export const NO_PRODUCTION_ORDER_ACTIONS: ProductionOrderActions = {
  edit: false,
  send: false,
  accept: false,
  changeExpected: false,
  startProduction: false,
  cancel: false,
  close: false,
  resend: false,
  startBlockedBySample: false,
};

type Subject = Pick<ProductionOrder, "status" | "sampleApprovalRequired">;

/**
 * Nút thao tác theo docs 17 §5.3. `channel` (từ `/dispatch`) chỉ cần cho "Gửi lại mail": kênh PDF thì Điều phối sản
 * xuất tự giao phiếu, không có mail để gửi lại.
 */
export function productionOrderActions(
  order: Subject,
  actor: ProductionOrderActor,
  channel?: ProducerChannel | null,
): ProductionOrderActions {
  const { status } = order;
  const update = actor.can(PRODUCTION_ORDER_PERMISSIONS.update);
  // Docs 17 §5.3: Sent → In Production chỉ do hệ thống khi hàng về (không cần duyệt mẫu); người dùng chỉ bắt đầu sản
  // xuất từ Accepted (BE `POST /production-start` — "an ACCEPTED production order", 409 PRODUCTION_ORDER_SAMPLE_REQUIRED)
  const startable = status === "ACCEPTED" && canTransition(status, "IN_PRODUCTION");
  return {
    edit: update && status === "DRAFT",
    // BR-23 (docs 17 §6, chốt lại 2026-11-20): người lập tự gửi được, không cần người thứ hai
    send: update && canTransition(status, "SENT"),
    accept: update && canTransition(status, "ACCEPTED"),
    changeExpected: update && EXPECTED_DATE_STATUSES.includes(status),
    // BR-24 (docs 17 §6): có cờ duyệt mẫu thì chỉ khách duyệt mẫu mới sang In Production
    startProduction: update && startable && !order.sampleApprovalRequired,
    // BR-06 (docs 17 §6): huỷ chỉ trước khi in hàng loạt; đóng chỉ từ In Production / Partially Received
    cancel: update && canTransition(status, "CANCELLED"),
    close: update && canTransition(status, "CLOSED"),
    resend: update && channel === "EMAIL" && RESENDABLE_STATUSES.includes(status),
    startBlockedBySample: update && startable && order.sampleApprovalRequired,
  };
}

/** Có nút ghi nào không — terminal thì luôn không (docs 17 §5.3). */
export const hasMutatingAction = (actions: ProductionOrderActions): boolean =>
  Object.entries(actions).some(([key, value]) => value && key !== "startBlockedBySample");
