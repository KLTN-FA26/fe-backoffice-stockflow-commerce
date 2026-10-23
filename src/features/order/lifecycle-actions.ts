/**
 * Order — bảng thao tác (`ORDER_ACTIONS`) + kiểu của chúng. Tách khỏi `lifecycle.ts` (giới hạn 200 dòng / file);
 * gate theo trạng thái / quyền / ngữ cảnh nằm ở `allowedOrderActions` trong `lifecycle.ts`.
 * Source: BE order/api/OrderStatus.java + OrderReleaseController (PR #133).
 */

import {
  ORDER_ACTION_LABELS,
  ORDER_MANUAL_HOLD_REASONS,
  ORDER_PERMISSIONS,
  ORDER_RELEASE_LABELS,
} from "@/constants";

import { isPackedOnlyAheadOfPrints } from "./partial-shipment";

import type { PermissionCode } from "@/lib/auth";
import type { Order, OrderStatus } from "./types";

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

export const NO_CONTEXT: OrderActionContext = {
  holdReason: null,
  hasShipments: false,
  packedAt: null,
};

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
  "admin-cancel" | "hold" | "resolve-hold" | "delivery-failure" | "remainder-closure" | "release";

/**
 * Lý do giữ mà điều phối viên gỡ tay được (`POST /orders/{id}/hold/resolution`). CREDIT đi qua duyệt
 * công nợ (`ORDER_CREDIT_HOLD_USE_APPROVAL`), DESIGN_MISMATCH qua kiểm tra lại kiện
 * (`ORDER_DESIGN_HOLD_USE_REVERIFICATION`); lý do lạ không đoán — không hiện nút.
 */
export function isManuallyResolvableHold(reason: Order["holdReason"]): boolean {
  return reason !== null && (ORDER_MANUAL_HOLD_REASONS as readonly string[]).includes(reason);
}

export const ORDER_ACTIONS: readonly OrderAction[] = [
  // BE `OrderReleaseController#release` (SCRUM-423): đơn CONFIRMED (đã trả đủ / cọc đã về) → IN_PRODUCTION nếu có
  // dòng in, còn lại READY_TO_FULFILL — nên không có `targetStatus` đơn lẻ. POST /orders/{id}/release,
  // sales-orders:APPROVE (scope ALL).
  {
    code: "release",
    label: ORDER_RELEASE_LABELS.button,
    permission: ORDER_PERMISSIONS.approve,
    fromStatuses: ["Confirmed"],
  },
  // BE `OrderStatus#canTransitionTo` (PR #133): → CANCELLED từ DRAFT … PICKING, ON_HOLD. PACKED trở đi (packedAt
  // đã có) KHÔNG huỷ được (BR-ORD-004) — đi luồng trả hàng; ngoại lệ (BE PR #150): đơn IN_PRODUCTION đã đóng sẵn
  // hàng có sẵn mà chưa bàn giao lô nào vẫn huỷ được (`isPackedOnlyAheadOfPrints`).
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
  // `Order#resolveHold`: chỉ giữ do điều phối viên nêu; CREDIT / DESIGN_MISMATCH bị BE từ chối. Đơn quay về
  // `statusBeforeHold` nên không có `targetStatus`. POST /orders/{id}/hold/resolution.
  {
    code: "resolve-hold",
    label: ORDER_ACTION_LABELS.resolveHold.button,
    permission: ORDER_PERMISSIONS.approve,
    fromStatuses: ["On Hold"],
    requires: ({ holdReason }) => isManuallyResolvableHold(holdReason),
  },
  // `Order#markDeliveryFailed`: SHIPPED / PARTIALLY_FULFILLED → DELIVERY_FAILED; đã chia lô thì BE 409
  // ORDER_DELIVERY_VIA_SHIPMENT. POST /orders/{id}/delivery-failure.
  {
    code: "delivery-failure",
    label: ORDER_ACTION_LABELS.deliveryFailure.button,
    permission: ORDER_PERMISSIONS.approve,
    fromStatuses: ["Shipped", "Partially Fulfilled"],
    targetStatus: "Delivery Failed",
    requires: ({ hasShipments }) => !hasShipments,
  },
  // `Order#closeRemainder`: chỉ từ PARTIALLY_FULFILLED (ON_HOLD phải gỡ giữ trước).
  // POST /orders/{id}/remainder-closure, sales-order-cancellations:UPDATE.
  {
    code: "remainder-closure",
    label: ORDER_ACTION_LABELS.remainderClosure.button,
    permission: ORDER_PERMISSIONS.cancel,
    fromStatuses: ["Partially Fulfilled"],
  },
] as const;
