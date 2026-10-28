/**
 * Order — bảng thao tác (`ORDER_ACTIONS`) + kiểu của chúng. Tách khỏi `lifecycle.ts` (giới hạn 200 dòng / file);
 * gate theo trạng thái / quyền / ngữ cảnh nằm ở `allowedOrderActions` trong `lifecycle.ts`.
 * Source: BE order/api/OrderStatus.java, Order.java (PR #133, #150), OrderReleaseController (SCRUM-423),
 * CreditHoldService (SCRUM-427).
 */

import {
  CREDIT_HOLD_PERMISSIONS,
  ORDER_ACTION_LABELS,
  ORDER_MANUAL_HOLD_REASONS,
  ORDER_PERMISSIONS,
  ORDER_RELEASE_LABELS,
  UI_LABELS,
} from "@/constants";

import { isPackedOnlyAheadOfPrints } from "./partial-shipment";

import type { PermissionCode } from "@/lib/auth";
import type { Order, OrderStatus } from "./types";

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
  /**
   * Trạng thái đơn quay về khi gỡ giữ (staff). Cần để biết đơn ON_HOLD có đang giữ từ IN_PRODUCTION
   * không — hàng có sẵn đóng trước hàng in vẫn huỷ được (BE PR #150, `Order#packedOnlyAheadOfPrints`).
   */
  readonly statusBeforeHold: Order["statusBeforeHold"] | undefined;
}

/** Ngữ cảnh khi FE không biết gì ngoài trạng thái — action phụ thuộc dữ kiện đều bị ẩn. */
export const UNKNOWN_CONTEXT: OrderActionContext = {
  paymentTerm: undefined,
  holdReason: undefined,
  hasShipments: undefined,
  packedAt: undefined,
  statusBeforeHold: undefined,
};

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
  readonly requires?: (context: OrderActionContext, status: OrderStatus) => boolean;
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
  // BE `OrderReleaseController#release` (SCRUM-423, PR #74): đơn CONFIRMED (đã trả đủ / cọc đã về) → IN_PRODUCTION
  // nếu có dòng in, còn lại READY_TO_FULFILL (BE chọn). Mẫu duyệt (BR-PRD-08), nợ quá hạn, cọc (BR-PRD-09), FTL + COD
  // (LP-2) là điều kiện server — hộp thoại release hiện lý do. POST /orders/{id}/release, sales-orders:APPROVE (scope ALL).
  {
    code: "release",
    label: ORDER_RELEASE_LABELS.button,
    permission: ORDER_PERMISSIONS.approve,
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
  // BR-ORD-004) — đi luồng trả hàng; ngoại lệ PACK-EARLY (BE PR #150) ở `requires`. Endpoint: POST /orders/{orderId}/admin-cancellation
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
    // gồm cả), trừ khi mới đóng hàng có sẵn trước hàng in và chưa có lô nào rời kho (BE PR #150,
    // `isPackedOnlyAheadOfPrints`). Chưa biết lịch sử đóng gói / lô giao (undefined) → không mở nút.
    requires: ({ packedAt, hasShipments, statusBeforeHold }, status) =>
      packedAt === null ||
      (packedAt !== undefined &&
        hasShipments !== undefined &&
        isPackedOnlyAheadOfPrints(status, { packedAt, hasShipments, statusBeforeHold })),
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
