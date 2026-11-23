/**
 * Lô hàng hoàn về — vòng đời hồ sơ + action-gating (WF-05 GH-1, BO-01; docs 09 §4.3, 17 §4.8).
 *
 * Bảng chuyển trạng thái chép từ BE `DeliveryFailureCase`, sau PR #377 (không còn "giao lại", Q-12/Q-13):
 * - Hồ sơ mới: BE mở rồi đóng ngay khi kho nhận hàng hoàn về (`CANCELLED`, `closure = RECORDED_ON_RETURN`).
 * - OPEN / REDELIVERY chỉ còn ở đơn cũ trước #377: lối ra duy nhất là CANCELLED (Sale huỷ phần chưa giao). BE không còn
 *   gọi `redelivered`, nên REDELIVERY → REDELIVERED không xảy ra nữa.
 * - REDELIVERED, CANCELLED: đóng (`Status#isClosed`).
 * UI-only — Backend phải re-check (DELIVERY_FAILURE_INVALID_TRANSITION, @RequiresPermission).
 */

import {
  DELIVERY_FAILURE_CASE_STATUS_DISPLAY,
  DELIVERY_FAILURE_LABELS,
  DELIVERY_FAILURE_UNDECIDED_STATUSES,
  ORDER_PERMISSIONS,
} from "@/constants";

import type { PermissionCode } from "@/lib/auth";
import type { DeliveryFailureCase, DeliveryFailureCaseStatus } from "./delivery-failure-schemas";
import type { Order, OrderShipment } from "./types";

export const DELIVERY_FAILURE_TRANSITIONS: Readonly<
  Record<DeliveryFailureCaseStatus, readonly DeliveryFailureCaseStatus[]>
> = {
  OPEN: ["CANCELLED"],
  REDELIVERY: ["CANCELLED"],
  REDELIVERED: [],
  CANCELLED: [],
  // Trạng thái BE thêm sau: FE không đoán — không thao tác
  UNKNOWN: [],
};

export type DeliveryFailureActionCode = "cancel-undelivered";

/** Đơn cũ (trước #377) đang giữ vì giao thất bại — chỉ đơn này còn "Huỷ phần chưa giao" (Q-13). */
export function isLegacyDeliveryFailureHold(order: Pick<Order, "status" | "holdReason">): boolean {
  return order.status === "On Hold" && order.holdReason === "DELIVERY_FAILED";
}

/**
 * Thao tác trên một hồ sơ: chỉ "Huỷ phần chưa giao" (`POST …/cancellation`, `sales-order-cancellations:UPDATE`), chỉ khi
 * hồ sơ chưa đóng VÀ đơn là đơn cũ đang giữ vì giao thất bại. Hàng đợi chung là lịch sử chỉ đọc (dòng không mang lý do
 * giữ của đơn), nên chỉ khối trong chi tiết đơn gọi hàm này.
 */
export function allowedDeliveryFailureActions(
  failure: Pick<DeliveryFailureCase, "status">,
  order: Pick<Order, "status" | "holdReason">,
  can: (code: PermissionCode) => boolean,
): DeliveryFailureActionCode[] {
  if (!isLegacyDeliveryFailureHold(order)) return [];
  if (!DELIVERY_FAILURE_TRANSITIONS[failure.status].includes("CANCELLED")) return [];
  return can(ORDER_PERMISSIONS.cancel) ? ["cancel-undelivered"] : [];
}

/**
 * Lịch sử: mới nhất trước (BE trả `openedAt` tăng dần). So theo thời điểm (offset khác nhau vẫn đúng); giá trị không
 * parse được xếp cuối, không làm hỏng danh sách.
 */
export function newestFirst<T extends Pick<DeliveryFailureCase, "openedAt">>(
  cases: readonly T[],
): T[] {
  const time = (value: string) => {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  };
  return [...cases].sort((a, b) => time(b.openedAt) - time(a.openedAt));
}

/** Hồ sơ còn chưa đóng (chỉ đơn cũ). */
export function isUndecidedCase(failure: Pick<DeliveryFailureCase, "status">): boolean {
  return (DELIVERY_FAILURE_UNDECIDED_STATUSES as readonly string[]).includes(failure.status);
}

/**
 * Nhãn + tone của hồ sơ. CANCELLED theo `closure` (F-4): kho ghi nhận hàng hoàn về khác hẳn Sale huỷ phần chưa giao;
 * BE chưa trả `closure` → "Đã đóng" (trung tính, không đoán ai đóng).
 */
export function deliveryFailureCaseDisplay(
  failure: Pick<DeliveryFailureCase, "status" | "closure">,
): { label: string; tone: string } {
  const L = DELIVERY_FAILURE_LABELS;
  if (failure.status === "CANCELLED" && failure.closure) {
    return {
      label: L.closureLabels[failure.closure],
      tone:
        failure.closure === "RECORDED_ON_RETURN"
          ? DELIVERY_FAILURE_CASE_STATUS_DISPLAY.RECORDED_ON_RETURN
          : DELIVERY_FAILURE_CASE_STATUS_DISPLAY.CANCELLED,
    };
  }
  return {
    label: L.statusLabels[failure.status],
    tone: DELIVERY_FAILURE_CASE_STATUS_DISPLAY[failure.status],
  };
}

/**
 * Ghi chú quyết định có hiện không: BE cũ ghi một câu hệ thống tiếng Anh vào `decisionNote` khi kho đóng hồ sơ lúc nhận
 * hàng (F-4 để null). `closure = RECORDED_ON_RETURN` không phải quyết định của người → không hiện.
 */
export function showsDecisionNote(
  failure: Pick<DeliveryFailureCase, "decisionNote" | "closure">,
): boolean {
  return !!failure.decisionNote && failure.closure !== "RECORDED_ON_RETURN";
}

/**
 * Huỷ phần chưa giao khi CHƯA có hồ sơ (`POST /orders/{id}/delivery-failures/cancellation`, WF-05 review F6.1): đơn cũ
 * đang giữ vì giao thất bại VÀ có lô đã về (RETURNED) mà chưa có hồ sơ — hàng mất trên đường về, hoặc kho chưa lập phiếu
 * nhận hàng hoàn. BE `uncased` còn xét "lô còn nợ đơn vị" (FE không biết) → BE vẫn có thể từ chối (409).
 */
export function canCancelWithoutCase(
  order: Pick<Order, "status" | "holdReason" | "shipments">,
  cases: readonly Pick<DeliveryFailureCase, "shipmentId">[],
  can: (code: PermissionCode) => boolean,
): boolean {
  if (!isLegacyDeliveryFailureHold(order)) return false;
  if (!can(ORDER_PERMISSIONS.cancel)) return false;
  const cased = new Set(cases.map((failure) => failure.shipmentId));
  return order.shipments.some(
    (shipment) => shipment.status === "RETURNED" && !cased.has(shipment.shipmentId),
  );
}

/** Đơn đã kết thúc (hoặc trạng thái lạ) — không mở "Đóng phần thất lạc". */
const LOST_CLOSURE_BLOCKED_ORDER_STATUSES: readonly Order["status"][] = [
  "Cancelled",
  "Completed",
  "Closed",
  "UNKNOWN",
];

/**
 * "Đóng phần thất lạc" (Q-12, F-5): lô giao thất bại mà hãng báo thất lạc (`LOST`), quyền
 * `sales-lost-shipment-closures:APPROVE`. Lô đã đóng vẫn giữ DELIVERY_FAILED + LOST, nên khi BE trả `lostClosable` thì
 * FE theo đúng cờ đó (không tự tính "còn nợ đơn vị"); vắng (BE chưa ship) → luật dự phòng theo trạng thái + lý do, BE vẫn
 * từ chối lần đóng thứ hai (409 ORDER_SHIPMENT_NOT_LOST_CLOSABLE, hộp thoại báo và tải lại). UI-only — Backend re-check.
 */
export function canCloseLostShipment(
  order: Pick<Order, "status">,
  shipment: Pick<OrderShipment, "status" | "failureReason" | "lostClosable">,
  can: (code: PermissionCode) => boolean,
): boolean {
  if (shipment.lostClosable === false) return false;
  if (shipment.status !== "DELIVERY_FAILED" || shipment.failureReason !== "LOST") return false;
  if (LOST_CLOSURE_BLOCKED_ORDER_STATUSES.includes(order.status)) return false;
  return can(ORDER_PERMISSIONS.lostShipmentClosure);
}
