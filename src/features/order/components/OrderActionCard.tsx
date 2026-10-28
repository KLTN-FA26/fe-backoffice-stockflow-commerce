import {
  CREDIT_HOLD_PERMISSIONS,
  ORDER_ACTION_LABELS,
  ORDER_HOLD_GUIDANCE,
  ORDER_PERMISSIONS,
  ORDER_RELEASE_BLOCKER_LABELS,
  ORDER_STATUS_UNKNOWN,
} from "@/constants";
import { StatusDot } from "@/components/shared/StatusDot";

import { allowedOrderActions, isOrderTerminal, orderActionContextOf } from "../lifecycle";
import { releaseBlockers } from "../release-rules";

import { CreditApproveAction } from "./credit-hold/CreditApproveAction";
import { CreditRejectAction } from "./credit-hold/CreditRejectAction";
import { OrderCancelAction } from "./OrderCancelAction";
import { OrderHoldNotice } from "./OrderHoldNotice";
import { OrderReleaseAction } from "./OrderReleaseAction";
import { OrderRemainderClosureAction } from "./OrderRemainderClosureAction";
import {
  OrderDeliveryFailureAction,
  OrderHoldAction,
  OrderResolveHoldAction,
} from "./OrderStatusActions";

import type { PermissionCode } from "@/lib/auth";
import type { OrderEstimateSlot } from "../estimate-slot";
import type { OrderActionCode } from "../lifecycle";
import type { Order, OrderReadStatus } from "../types";

interface OrderActionCardProps {
  order: Order;
  can: (code: PermissionCode) => boolean;
  /** Khe "Ước tính xếp xe" trong hộp thoại release (xem `estimate-slot.ts`). */
  estimateSlot?: OrderEstimateSlot;
}

/** Trạng thái đã đóng gói / bàn giao — BE không cho huỷ (BR-ORD-004), xử lý qua luồng trả hàng. */
const PACKED_ONWARDS: readonly OrderReadStatus[] = [
  "Packed",
  "Partially Fulfilled",
  "Shipped",
  "Delivery Failed",
  "Delivered",
  "Return Requested",
  "Returned",
  "Refunded",
  "Partially Refunded",
];

/** Mã quyền ghi bất kỳ trên đơn — thiếu hết thì người xem chỉ đọc. */
const WRITE_PERMISSIONS: readonly PermissionCode[] = [
  ORDER_PERMISSIONS.cancel,
  ORDER_PERMISSIONS.approve,
  ORDER_PERMISSIONS.release,
  CREDIT_HOLD_PERMISSIONS.approve,
];

/**
 * Vì sao không có nút thao tác — theo trạng thái + quyền, để người dùng không tưởng là lỗi. Không nói
 * "đã bàn giao" với đơn chỉ đang lấy hàng / tạm giữ.
 */
function noActionReason(order: Pick<Order, "status">, can: OrderActionCardProps["can"]): string {
  // Trạng thái BE mới FE chưa hỗ trợ — không đoán thao tác (không phải "đã kết thúc")
  if (order.status === ORDER_STATUS_UNKNOWN) {
    return "Trạng thái đơn chưa được hỗ trợ — không có thao tác.";
  }
  if (isOrderTerminal(order.status)) return "Đơn đã kết thúc — không còn thao tác.";
  if (!WRITE_PERMISSIONS.some(can)) return "Bạn chỉ có quyền xem đơn hàng.";
  if (order.status === "On Hold") {
    return "Đơn đang tạm giữ — việc gỡ giữ / duyệt cần quyền khác với quyền của bạn.";
  }
  // BR-ORD-004: từ PACKED hàng đã đóng — không huỷ được, đi luồng trả hàng
  if (PACKED_ONWARDS.includes(order.status)) {
    return "Đơn đã đóng gói / bàn giao vận chuyển — không huỷ được, xử lý qua luồng trả hàng.";
  }
  return "Không có thao tác nào bạn được phép làm ở trạng thái này.";
}

/**
 * Vì sao không có nút "Gỡ giữ" khi đơn bị giữ: giữ do hệ thống → nói xử lý ở đâu; lý do không rõ
 * (BE thêm mã mới / không trả `holdReason`) → không đoán, báo chưa gỡ được. Giữ do điều phối viên mà
 * người xem thiếu quyền thì không cần giải thích thêm.
 */
function holdGuidanceFor(
  order: Pick<Order, "holdReason">,
  can: (code: PermissionCode) => boolean,
): string | null {
  switch (order.holdReason) {
    case "CREDIT":
      return ORDER_HOLD_GUIDANCE.CREDIT;
    case "DESIGN_MISMATCH":
      return ORDER_HOLD_GUIDANCE.DESIGN_MISMATCH;
    case null:
    case "UNKNOWN":
      return can(ORDER_PERMISSIONS.approve) ? ORDER_HOLD_GUIDANCE.UNRESOLVABLE : null;
    default:
      return null;
  }
}

/**
 * Card trạng thái + thao tác ở cột phải trang chi tiết (cùng bố cục ActionCard của NCC).
 * Nút do `allowedOrderActions` quyết MỘT lần (trạng thái + mã quyền + ngữ cảnh đơn: lý do giữ, đã chia
 * lô, đã đóng gói, giữ công nợ) — không rải điều kiện vòng đời trong JSX.
 * UI-only gating — Backend phải re-check (bảng chuyển trạng thái BE PR #133, OrderReleaseService,
 * CreditHoldService, Order#requireNotPacked).
 */
export function OrderActionCard({ order, can, estimateSlot }: OrderActionCardProps) {
  const actions = allowedOrderActions(order.status, can, orderActionContextOf(order));
  const has = (code: OrderActionCode) => actions.some((a) => a.code === code);
  const onHold = order.status === "On Hold";
  // Giữ do hệ thống: nói rõ phải xử lý ở đâu thay vì để người dùng tìm nút "Gỡ giữ" không có
  const holdGuidance =
    onHold && !has("resolve-hold") && !has("credit-approve") ? holdGuidanceFor(order, can) : null;
  const shipmentsHint =
    order.shipments.length > 0 &&
    (order.status === "Shipped" || order.status === "Partially Fulfilled") &&
    can(ORDER_PERMISSIONS.approve)
      ? ORDER_ACTION_LABELS.shipmentsHint
      : null;
  const guidance = holdGuidance ?? shipmentsHint;
  // Lý do biết trước chưa release được (đơn cọc chưa nhận cọc): chỉ cho người có quyền release; nói ra thay vì ẩn nút.
  // UI-only — Backend phải re-check (OrderReleaseService: BR-PRD-09).
  const blockers = can(ORDER_PERMISSIONS.approve) ? releaseBlockers(order) : [];

  return (
    <section
      aria-label="Thao tác đơn"
      className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]"
    >
      <div className="mb-4 flex justify-center">
        <StatusDot domain="order" status={order.status} size="md" withIcon />
      </div>
      {onHold && <OrderHoldNotice order={order} />}
      {actions.length > 0 ? (
        <div className="space-y-2">
          {has("release") && (
            <OrderReleaseAction order={order} can={can} estimateSlot={estimateSlot} />
          )}
          {has("credit-approve") && <CreditApproveAction order={order} />}
          {has("credit-reject") && <CreditRejectAction order={order} />}
          {has("hold") && <OrderHoldAction order={order} />}
          {has("resolve-hold") && <OrderResolveHoldAction order={order} />}
          {has("delivery-failure") && <OrderDeliveryFailureAction order={order} />}
          {has("remainder-closure") && <OrderRemainderClosureAction order={order} />}
          {has("admin-cancel") && <OrderCancelAction order={order} />}
        </div>
      ) : null}
      {blockers.length > 0 && (
        <div className="border-border-default bg-bg-subtle mt-3 rounded-[var(--r-sm)] border px-3 py-2 text-xs">
          <p className="text-ink-primary font-medium">{ORDER_RELEASE_BLOCKER_LABELS.title}</p>
          <ul className="text-ink-secondary mt-1 space-y-0.5">
            {blockers.map((blocker) => (
              <li key={blocker.rule}>
                <span className="font-[family-name:var(--font-mono)]">{blocker.rule}</span> ·{" "}
                {blocker.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {guidance && <p className="text-ink-secondary mt-3 text-center text-xs">{guidance}</p>}
      {actions.length === 0 && blockers.length === 0 && !guidance && (
        <p className="text-ink-tertiary text-center text-xs">{noActionReason(order, can)}</p>
      )}
    </section>
  );
}
