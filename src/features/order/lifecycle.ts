/**
 * Order — lifecycle & action-gating.
 *
 * Re-exports transition table from domain/lifecycle.ts (single source of truth).
 * Adds `allowedOrderActions()` for UI action-gating per status + mã quyền BE
 * (`/identity/me/permissions`), như `allowedSupplierActions`.
 *
 * Source: BE order/api/OrderStatus.java + OrderReleaseController (PR #133; FE khớp BE — xem ORDER_STATUSES).
 */

import { ORDER_ACTION_LABELS, ORDER_MANUAL_HOLD_REASONS, ORDER_PERMISSIONS } from "@/constants";
import {
  ORDER_TRANSITIONS,
  allowedTransitions,
  canTransition,
  isTerminal,
} from "@/lib/domain/lifecycle";

import type { PermissionCode } from "@/lib/auth";
import type { Order, OrderStatus } from "./types";

/* ── Re-exports ──────────────────────────────────────────────────────── */

export { ORDER_TRANSITIONS, allowedTransitions, canTransition, isTerminal };

/* ── Action definitions ──────────────────────────────────────────────── */

/** Dữ kiện ngoài trạng thái mà BE xét khi cho / từ chối một thao tác. */
export interface OrderActionContext {
  /** Lý do đang giữ (staff); null khi không ON_HOLD. */
  readonly holdReason: Order["holdReason"];
  /** Đơn đã có lô giao: kết quả giao ghi theo từng lô, không ghi ở cấp đơn. */
  readonly hasShipments: boolean;
  /**
   * Mốc đóng gói xong lần đầu (BE `packedAt`). Đã có thì BE từ chối huỷ (`Order#requireNotPacked`,
   * ORDER_NOT_CANCELLABLE) — kể cả đơn ON_HOLD bị giữ từ PACKED / PARTIALLY_FULFILLED.
   */
  readonly packedAt: string | null;
  /**
   * Trạng thái đơn quay về khi gỡ giữ (staff). Cần để biết đơn ON_HOLD có đang giữ từ IN_PRODUCTION
   * không — hàng có sẵn đóng trước hàng in vẫn huỷ được (BE PR #150, `Order#packedOnlyAheadOfPrints`).
   */
  readonly statusBeforeHold?: Order["statusBeforeHold"];
}

const NO_CONTEXT: OrderActionContext = { holdReason: null, hasShipments: false, packedAt: null };

/**
 * BE `Order#packedOnlyAheadOfPrints` (BE PR #150, PACK-EARLY): hàng có sẵn của đơn còn đang in đã đóng
 * thành kiện nhưng CHƯA bàn giao lô nào → kiện còn nằm trong kho, huỷ được (huỷ kiện, trả hàng về tồn,
 * quy tắc phí khi đang in). Đã có lô rời đi hoặc đơn đã PACKED trở đi thì phải đi luồng trả hàng.
 * BE không trả cờ "huỷ được" nên FE đối chiếu cùng điều kiện (17 §4.5 bước 15).
 */
export function isPackedOnlyAheadOfPrints(
  status: OrderStatus,
  { packedAt, hasShipments, statusBeforeHold }: OrderActionContext,
): boolean {
  const printing =
    status === "In Production" || (status === "On Hold" && statusBeforeHold === "In Production");
  return packedAt !== null && printing && !hasShipments;
}

/** Actions the UI can gate per status + permission code (+ ngữ cảnh đơn). */
export interface OrderAction {
  /** Unique action code. */
  readonly code: OrderActionCode;
  /** Button label. */
  readonly label: string;
  /** Mã quyền BE cần có. */
  readonly permission: PermissionCode;
  /** Statuses where this action is available. */
  readonly fromStatuses: readonly OrderStatus[];
  /** Target status after action (undefined = non-transition action). */
  readonly targetStatus?: OrderStatus;
  /** Điều kiện thêm ngoài trạng thái (vd lý do giữ, đã chia lô). */
  readonly requires?: (context: OrderActionContext, status: OrderStatus) => boolean;
  /** Destructive action styling. */
  readonly destructive?: boolean;
}

export type OrderActionCode =
  "admin-cancel" | "hold" | "resolve-hold" | "delivery-failure" | "remainder-closure";

/**
 * Lý do giữ mà điều phối viên gỡ tay được (`POST /orders/{id}/hold/resolution`). CREDIT đi qua duyệt
 * công nợ (`ORDER_CREDIT_HOLD_USE_APPROVAL`), DESIGN_MISMATCH qua kiểm tra lại kiện
 * (`ORDER_DESIGN_HOLD_USE_REVERIFICATION`); lý do lạ không đoán — không hiện nút.
 */
export function isManuallyResolvableHold(reason: Order["holdReason"]): boolean {
  return reason !== null && (ORDER_MANUAL_HOLD_REASONS as readonly string[]).includes(reason);
}

export const ORDER_ACTIONS: readonly OrderAction[] = [
  // BE `OrderStatus#canTransitionTo` (PR #133): → CANCELLED từ DRAFT, PENDING_PAYMENT, CONFIRMED,
  // IN_PRODUCTION, READY_TO_FULFILL, PICKING, ON_HOLD. PACKED trở đi (packedAt đã có) KHÔNG huỷ được (quyết định
  // 17/10, BR-ORD-004) — đi luồng trả hàng; ngoại lệ (BE PR #150): đơn IN_PRODUCTION đã đóng sẵn hàng có sẵn
  // mà chưa bàn giao lô nào vẫn huỷ được (`isPackedOnlyAheadOfPrints`). Endpoint:
  // POST /orders/{orderId}/admin-cancellation (BE sales-order-cancellations:UPDATE, scope ALL).
  {
    code: "admin-cancel",
    label: "Huỷ đơn",
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
    targetStatus: "Cancelled",
    // `Order#requireNotPacked` (03 §9): đã đóng gói thì không huỷ — bất kể trạng thái hiện tại (ON_HOLD gồm cả),
    // trừ khi mới đóng hàng có sẵn trước hàng in và chưa có lô nào rời kho
    requires: (context, status) =>
      context.packedAt === null || isPackedOnlyAheadOfPrints(status, context),
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
    targetStatus: "On Hold",
  },
  // `Order#resolveHold`: chỉ giữ do điều phối viên nêu; CREDIT / DESIGN_MISMATCH bị BE từ chối.
  // Đơn quay về `statusBeforeHold`, nên không gắn `targetStatus` đơn lẻ. POST /orders/{id}/hold/resolution.
  {
    code: "resolve-hold",
    label: ORDER_ACTION_LABELS.resolveHold.button,
    permission: ORDER_PERMISSIONS.approve,
    fromStatuses: ["On Hold"],
    requires: ({ holdReason }) => isManuallyResolvableHold(holdReason),
  },
  // `Order#markDeliveryFailed`: SHIPPED / PARTIALLY_FULFILLED → DELIVERY_FAILED; đơn đã chia lô thì
  // BE trả 409 ORDER_DELIVERY_VIA_SHIPMENT (kết quả ghi theo lô). POST /orders/{id}/delivery-failure.
  {
    code: "delivery-failure",
    label: ORDER_ACTION_LABELS.deliveryFailure.button,
    permission: ORDER_PERMISSIONS.approve,
    fromStatuses: ["Shipped", "Partially Fulfilled"],
    targetStatus: "Delivery Failed",
    requires: ({ hasShipments }) => !hasShipments,
  },
  // `Order#closeRemainder`: chỉ từ PARTIALLY_FULFILLED (đơn ON_HOLD phải gỡ giữ trước); đơn chuyển theo
  // các lô giao. POST /orders/{id}/remainder-closure, sales-order-cancellations:UPDATE.
  {
    code: "remainder-closure",
    label: ORDER_ACTION_LABELS.remainderClosure.button,
    permission: ORDER_PERMISSIONS.cancel,
    fromStatuses: ["Partially Fulfilled"],
  },
] as const;

/* ── Action gating ───────────────────────────────────────────────────── */

/**
 * Return the list of actions available for a given order status + permission checker.
 *
 * Checks:
 * 1. Action's `fromStatuses` includes current status.
 * 2. If action has `targetStatus`, the transition table allows it.
 * 3. Điều kiện thêm `requires` (lý do giữ, đã chia lô) thoả.
 * 4. Người dùng có mã quyền BE yêu cầu (`can` = `usePermissionChecker()` ở component).
 *
 * UI-only gating — Backend phải re-check (bảng chuyển trạng thái + @RequiresPermission).
 */
export function allowedOrderActions(
  status: OrderStatus,
  can: (code: PermissionCode) => boolean,
  context: OrderActionContext = NO_CONTEXT,
): readonly OrderAction[] {
  return ORDER_ACTIONS.filter((action) => {
    // 1. Status gate
    if (!action.fromStatuses.includes(status)) return false;

    // 2. Transition gate
    if (action.targetStatus && !canTransition(ORDER_TRANSITIONS, status, action.targetStatus)) {
      return false;
    }

    // 3. Context gate
    if (action.requires && !action.requires(context, status)) return false;

    // 4. Permission gate
    return can(action.permission);
  });
}

/** Check if the order is in a terminal (final) state. */
export function isOrderTerminal(status: OrderStatus): boolean {
  return isTerminal(ORDER_TRANSITIONS, status);
}

/** Get allowed next statuses from the transition table. */
export function nextOrderStatuses(status: OrderStatus): readonly OrderStatus[] {
  return allowedTransitions(ORDER_TRANSITIONS, status);
}

/* ── Giao một phần (BE PR #150, PACK-PARTIAL) ────────────────────────── */

/**
 * BE `Order#decidePartialShipment`: Sales đổi được cho tới khi hàng đi hết / đơn đóng. Từ SHIPPED trở đi
 * (giao thất bại, đã giao, trả hàng, hoàn tiền, hoàn tất, huỷ, đóng sổ) → 409 ORDER_PARTIAL_SHIPMENT_LOCKED.
 */
export const PARTIAL_SHIPMENT_OPEN_STATUSES: readonly OrderStatus[] = [
  "Draft",
  "Pending Payment",
  "Confirmed",
  "In Production",
  "Ready to Fulfill",
  "Picking",
  "Partially Fulfilled",
  "Packed",
  "On Hold",
];

export type PartialShipmentLock = "closed" | "awaiting-prints";

/** Điều khiển "Giao một phần" trên chi tiết đơn: trạng thái hiện tại + việc nút sẽ làm. */
export interface PartialShipmentControl {
  /** Cờ hiện tại của đơn. */
  readonly allowed: boolean;
  /** Giá trị nút sẽ đặt (ngược với `allowed`). */
  readonly next: boolean;
  /** Có quyền VÀ đơn chưa bị khoá — mới hiện nút. */
  readonly canChange: boolean;
  /** Vì sao không đổi được dù có quyền (null = không bị khoá). */
  readonly lock: PartialShipmentLock | null;
}

/**
 * Điều khiển giao một phần của đơn, hoặc null khi BE không trả cờ (không đoán). Khoá:
 * - đơn đã đi / đóng (`PARTIAL_SHIPMENT_OPEN_STATUSES`);
 * - đang bật mà đơn PARTIALLY_FULFILLED còn chờ hàng in (`printLinesReady = false`): hàng có sẵn đã đi trước
 *   hàng in nên đơn đã tách — BE 409 khi tắt. Khoá này chỉ gợi ý sớm; BE vẫn là người quyết (đơn ON_HOLD giữ từ
 *   trạng thái đó chỉ biết qua 409).
 * Quyền tra theo MÃ (`sales-order-partial-shipments:UPDATE`), không theo vai trò.
 */
export function partialShipmentControl(
  order: Pick<Order, "status" | "allowPartialShipment" | "printLinesReady">,
  can: (code: PermissionCode) => boolean,
): PartialShipmentControl | null {
  if (order.allowPartialShipment === null) return null;
  const allowed = order.allowPartialShipment;
  // Trạng thái chưa hỗ trợ: không đoán là đã đóng — chỉ hiện cờ, không cho đổi
  if (order.status === "UNKNOWN") return { allowed, next: !allowed, lock: null, canChange: false };
  let lock: PartialShipmentLock | null = null;
  if (!PARTIAL_SHIPMENT_OPEN_STATUSES.includes(order.status)) lock = "closed";
  else if (allowed && order.status === "Partially Fulfilled" && order.printLinesReady === false) {
    lock = "awaiting-prints";
  }
  return {
    allowed,
    next: !allowed,
    lock,
    canChange: lock === null && can(ORDER_PERMISSIONS.partialShipment),
  };
}
