/**
 * Order — lifecycle & action-gating.
 *
 * Re-exports transition table from domain/lifecycle.ts (single source of truth).
 * Adds `allowedOrderActions()` for UI action-gating per status + mã quyền BE
 * (`/identity/me/permissions`) + ngữ cảnh đơn, như `allowedSupplierActions`.
 *
 * Source: BE order/api/OrderStatus.java, Order.java (PR #133), OrderReleaseService (SCRUM-423),
 * CreditHoldService (SCRUM-427) — FE khớp BE, xem ORDER_STATUSES.
 */

import {
  CREDIT_HOLD_PERMISSIONS,
  ORDER_ACTION_LABELS,
  ORDER_MANUAL_HOLD_REASONS,
  ORDER_PERMISSIONS,
  ORDER_STATUS_UNKNOWN,
  UI_LABELS,
} from "@/constants";
import {
  ORDER_TRANSITIONS,
  allowedTransitions,
  canTransition,
  isTerminal,
} from "@/lib/domain/lifecycle";

import type { PermissionCode } from "@/lib/auth";
import type { Order, OrderReadStatus, OrderStatus } from "./types";

/* ── Re-exports ──────────────────────────────────────────────────────── */

export { ORDER_TRANSITIONS, allowedTransitions, canTransition, isTerminal };

/* ── Action definitions ──────────────────────────────────────────────── */

/**
 * Dữ kiện đơn ngoài trạng thái mà BE xét khi cho / từ chối một thao tác. MỌI key bắt buộc truyền;
 * `undefined` = FE KHÔNG BIẾT (vd dòng danh sách không mang field) — khác `null` (BE trả "không có").
 * Thiếu dữ kiện thì action phụ thuộc vào nó bị ẩn, không bao giờ coi như trạng thái an toàn.
 */
export interface OrderActionContext {
  /** BE `paymentTerm`; null / undefined → không phải giữ công nợ đã xác nhận. */
  readonly paymentTerm: Order["paymentTerm"] | undefined;
  /** Lý do đang giữ (staff); null khi không ON_HOLD. */
  readonly holdReason: Order["holdReason"] | undefined;
  /** Đơn đã có lô giao: kết quả giao ghi theo từng lô, không ghi ở cấp đơn (G4-Q5). */
  readonly hasShipments: boolean | undefined;
  /**
   * Mốc đóng gói xong lần đầu (BE `packedAt`). Đã có thì BE từ chối huỷ (`Order#requireNotPacked`,
   * ORDER_NOT_CANCELLABLE) — kể cả đơn ON_HOLD bị giữ từ PACKED / PARTIALLY_FULFILLED. `undefined`
   * (chưa biết lịch sử đóng gói) cũng chặn huỷ.
   */
  readonly packedAt: Order["packedAt"] | undefined;
}

export type OrderActionCode =
  | "release"
  | "credit-approve"
  | "credit-reject"
  | "admin-cancel"
  | "hold"
  | "resolve-hold"
  | "delivery-failure"
  | "remainder-closure";

/**
 * Kết quả trạng thái của một action — không giả vờ mọi thao tác BE có một đích cố định:
 * - `to`: một hoặc nhiều đích BE có thể chọn (vd release → In Production / Ready to Fulfill). Mọi đích
 *   phải hợp lệ theo ORDER_TRANSITIONS từ trạng thái hiện tại.
 * - `restore-before-hold`: về `statusBeforeHold` đã lưu (gỡ giữ) — BE tự chọn, luôn là cạnh hợp lệ.
 * - `follow-shipments`: đơn theo các lô giao (BE `Order#followShipments`); có thể giữ nguyên trạng thái
 *   khi chưa có lô. `possible` liệt kê các trạng thái mới có thể có — mỗi cái phải là cạnh hợp lệ.
 */
export type OrderActionOutcome =
  | { readonly kind: "to"; readonly statuses: readonly [OrderStatus, ...OrderStatus[]] }
  | { readonly kind: "restore-before-hold" }
  | { readonly kind: "follow-shipments"; readonly possible: readonly OrderStatus[] };

/** Actions the UI can gate per status + permission code + ngữ cảnh đơn. */
export interface OrderAction {
  /** Unique action code. */
  readonly code: OrderActionCode;
  /** Button label (động từ). */
  readonly label: string;
  /** Mã quyền BE cần có. */
  readonly permission: PermissionCode;
  /** Statuses where this action is available. */
  readonly fromStatuses: readonly OrderStatus[];
  /** Trạng thái sau thao tác — xem `OrderActionOutcome`. */
  readonly outcome: OrderActionOutcome;
  /** Điều kiện thêm ngoài trạng thái (lý do giữ, đã chia lô, đã đóng gói, phương thức). */
  readonly requires?: (context: OrderActionContext) => boolean;
  /** Destructive action styling. */
  readonly destructive?: boolean;
}

/**
 * Lý do giữ mà điều phối viên gỡ tay được (`POST /orders/{id}/hold/resolution`). CREDIT đi qua duyệt
 * công nợ (`ORDER_CREDIT_HOLD_USE_APPROVAL`), DESIGN_MISMATCH qua kiểm tra lại kiện
 * (`ORDER_DESIGN_HOLD_USE_REVERIFICATION`); lý do lạ / vắng không đoán — không hiện nút.
 */
export function isManuallyResolvableHold(reason: Order["holdReason"] | undefined): boolean {
  return reason != null && (ORDER_MANUAL_HOLD_REASONS as readonly string[]).includes(reason);
}

/**
 * Giữ công nợ thật (đơn vượt hạn mức chờ quyết định): BE `Order#requireCreditHold` (ON_HOLD +
 * phương thức CREDIT) VÀ `CreditHoldService#decide` (hồ sơ giữ lý do CREDIT). Đơn công nợ bị giữ vì
 * địa chỉ / thiết kế / giữ tay KHÔNG phải — ORDER_NOT_ON_CREDIT_HOLD.
 */
export function isCreditHold(context: Pick<OrderActionContext, "holdReason" | "paymentTerm">) {
  return context.holdReason === "CREDIT" && context.paymentTerm === "CREDIT";
}

export const ORDER_ACTIONS: readonly OrderAction[] = [
  // SCRUM-423 / docs 17 §4.2 bước 4–6 + BR-02: BE `Order#release` chỉ nhận CONFIRMED; có dòng in →
  // IN_PRODUCTION, chỉ hàng sẵn → READY_TO_FULFILL (BE chọn). Mẫu duyệt (BR-PRD-08), nợ quá hạn, cọc
  // (BR-PRD-09), kho tồn tại là điều kiện server — FE không đoán, BE trả lỗi riêng.
  // Endpoint: POST /orders/{id}/release (BE sales-orders:APPROVE — chỉ ORDER_COORDINATOR).
  {
    code: "release",
    label: UI_LABELS.order.actions.release,
    permission: ORDER_PERMISSIONS.release,
    fromStatuses: ["Confirmed"],
    outcome: { kind: "to", statuses: ["In Production", "Ready to Fulfill"] },
  },
  // SCRUM-427 / docs 14 BR-06: đơn công nợ vượt hạn mức chờ người có quyền duyệt (Order#approveCredit).
  // POST /orders/{id}/credit-approval (sales-order-credit-holds:APPROVE — ACCOUNTANT).
  {
    code: "credit-approve",
    label: UI_LABELS.order.actions.creditApprove,
    permission: CREDIT_HOLD_PERMISSIONS.approve,
    fromStatuses: ["On Hold"],
    outcome: { kind: "to", statuses: ["Confirmed"] },
    requires: isCreditHold,
  },
  // docs 15 §4.3: từ chối → huỷ, hoặc chuyển sang trả trước / đặt cọc (về Pending Payment).
  {
    code: "credit-reject",
    label: UI_LABELS.order.actions.creditReject,
    permission: CREDIT_HOLD_PERMISSIONS.approve,
    fromStatuses: ["On Hold"],
    outcome: { kind: "to", statuses: ["Cancelled", "Pending Payment"] },
    requires: isCreditHold,
    destructive: true,
  },
  // BE `OrderStatus#canTransitionTo` (PR #133): → CANCELLED từ DRAFT, PENDING_PAYMENT, CONFIRMED,
  // IN_PRODUCTION, READY_TO_FULFILL, PICKING, ON_HOLD. PACKED trở đi KHÔNG huỷ được (quyết định 17/10,
  // BR-ORD-004) — đi luồng trả hàng. Endpoint: POST /orders/{orderId}/admin-cancellation
  // (BE sales-order-cancellations:UPDATE, scope ALL).
  {
    code: "admin-cancel",
    label: UI_LABELS.order.actions.cancel,
    permission: ORDER_PERMISSIONS.cancel,
    fromStatuses: [
      "Draft",
      "Pending Payment",
      "Confirmed",
      "In Production",
      "Ready to Fulfill",
      "Picking",
      "On Hold",
    ],
    outcome: { kind: "to", statuses: ["Cancelled"] },
    // `Order#requireNotPacked` (03 §9): đã đóng gói thì không huỷ — bất kể trạng thái hiện tại (ON_HOLD
    // gồm cả). Chưa biết lịch sử đóng gói (undefined) → không mở nút.
    requires: ({ packedAt }) => packedAt === null,
    destructive: true,
  },
  // `OrderStatus#mayBePutOnHold`: CONFIRMED … PACKED (kể cả giao một phần). POST /orders/{id}/hold,
  // sales-orders:APPROVE. Không giữ lần hai: đơn đang ON_HOLD phải gỡ giữ trước.
  {
    code: "hold",
    label: ORDER_ACTION_LABELS.hold.button,
    permission: ORDER_PERMISSIONS.approve,
    fromStatuses: [
      "Confirmed",
      "In Production",
      "Ready to Fulfill",
      "Picking",
      "Partially Fulfilled",
      "Packed",
    ],
    outcome: { kind: "to", statuses: ["On Hold"] },
  },
  // `Order#resolveHold`: chỉ giữ do điều phối viên nêu; CREDIT / DESIGN_MISMATCH bị BE từ chối. Đơn quay
  // về `statusBeforeHold` (rồi theo lô giao). POST /orders/{id}/hold/resolution.
  {
    code: "resolve-hold",
    label: ORDER_ACTION_LABELS.resolveHold.button,
    permission: ORDER_PERMISSIONS.approve,
    fromStatuses: ["On Hold"],
    outcome: { kind: "restore-before-hold" },
    requires: ({ holdReason }) => isManuallyResolvableHold(holdReason),
  },
  // `Order#markDeliveryFailed`: SHIPPED / PARTIALLY_FULFILLED → DELIVERY_FAILED; đơn đã chia lô thì
  // BE trả 409 ORDER_DELIVERY_VIA_SHIPMENT (kết quả ghi theo lô). POST /orders/{id}/delivery-failure.
  {
    code: "delivery-failure",
    label: ORDER_ACTION_LABELS.deliveryFailure.button,
    permission: ORDER_PERMISSIONS.approve,
    fromStatuses: ["Shipped", "Partially Fulfilled"],
    outcome: { kind: "to", statuses: ["Delivery Failed"] },
    // Chưa biết đơn có lô hay không (undefined) → không mở nút
    requires: ({ hasShipments }) => hasShipments === false,
  },
  // `Order#closeRemainder`: chỉ từ PARTIALLY_FULFILLED (đơn ON_HOLD phải gỡ giữ trước); đơn chuyển theo
  // các lô giao (Shipped / Delivery Failed / Delivered / Returned, hoặc giữ nguyên khi chưa có lô).
  // POST /orders/{id}/remainder-closure, sales-order-cancellations:UPDATE.
  {
    code: "remainder-closure",
    label: ORDER_ACTION_LABELS.remainderClosure.button,
    permission: ORDER_PERMISSIONS.cancel,
    fromStatuses: ["Partially Fulfilled"],
    outcome: {
      kind: "follow-shipments",
      possible: ["Shipped", "Delivery Failed", "Delivered", "Returned"],
    },
  },
] as const;

/** Các đích tĩnh của action phải là cạnh hợp lệ từ `status` (khôi phục trạng thái cũ: BE tự chọn). */
function outcomeAllowed(outcome: OrderActionOutcome, status: OrderStatus): boolean {
  switch (outcome.kind) {
    case "to":
      return outcome.statuses.every((target) => canTransition(ORDER_TRANSITIONS, status, target));
    case "follow-shipments":
      return outcome.possible.every((target) => canTransition(ORDER_TRANSITIONS, status, target));
    case "restore-before-hold":
      return true;
  }
}

/* ── Action gating ───────────────────────────────────────────────────── */

/**
 * Return the list of actions available for a given order status + permission checker + ngữ cảnh.
 *
 * Checks:
 * 1. Action's `fromStatuses` includes current status.
 * 2. Các đích tĩnh của action hợp lệ theo bảng chuyển tiếp (`outcomeAllowed`).
 * 3. Điều kiện thêm (`requires`) trên `context` — lý do giữ, đã chia lô, đã đóng gói, giữ công nợ.
 * 4. Người dùng có mã quyền BE yêu cầu (`can` = `usePermissionChecker()` ở component).
 * `UNKNOWN` (trạng thái BE FE chưa hỗ trợ) → không action nào.
 *
 * UI-only gating — Backend phải re-check (bảng chuyển trạng thái, Order#requireNotPacked,
 * OrderReleaseService, CreditHoldService + @RequiresPermission; docs 17 BR-02/BR-03).
 */
export function allowedOrderActions(
  status: OrderReadStatus,
  can: (code: PermissionCode) => boolean,
  context: OrderActionContext,
): readonly OrderAction[] {
  if (status === ORDER_STATUS_UNKNOWN) return [];
  return ORDER_ACTIONS.filter((action) => {
    // 1. Status gate
    if (!action.fromStatuses.includes(status)) return false;
    // 2. Transition gate
    if (!outcomeAllowed(action.outcome, status)) return false;
    // 3. Context gate
    if (action.requires && !action.requires(context)) return false;
    // 4. Permission gate
    return can(action.permission);
  });
}

/** Ngữ cảnh action dựng từ đơn chi tiết (`GET /orders/{id}`) — mọi field BE đã trả hoặc chuẩn hoá null. */
export function orderActionContextOf(
  order: Pick<Order, "paymentTerm" | "holdReason" | "shipments" | "packedAt">,
): OrderActionContext {
  return {
    paymentTerm: order.paymentTerm,
    holdReason: order.holdReason,
    hasShipments: order.shipments.length > 0,
    packedAt: order.packedAt,
  };
}

/**
 * Check if the order is in a terminal (final) state. `UNKNOWN` không có chuyển tiếp nhưng KHÔNG
 * phải đã kết thúc — chỉ là FE chưa hiểu trạng thái đó.
 */
export function isOrderTerminal(status: OrderReadStatus): boolean {
  return status !== ORDER_STATUS_UNKNOWN && isTerminal(ORDER_TRANSITIONS, status);
}

/** Get allowed next statuses from the transition table — luôn là trạng thái đã biết, không bao giờ UNKNOWN. */
export function nextOrderStatuses(status: OrderReadStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[status];
}
