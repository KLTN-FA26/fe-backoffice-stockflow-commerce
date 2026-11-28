import { Fragment } from "react";

import {
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS,
  ORDER_ACTION_LABELS,
  ORDER_PERMISSIONS,
  ORDER_RELEASE_BLOCKER_LABELS,
} from "@/constants";
import { PAYMENT_INSTALLMENT_PERMISSIONS } from "@/constants/payment";

import { ObjectActions } from "@/components/shared/ObjectActions";

import { allowedOrderActions, orderActionContextOf } from "../lifecycle";
import { createPickingTaskHref } from "../picking-task";
import { useOrderInstallmentsSummary } from "../queries";
import { releaseBlockers } from "../release-rules";

import { CreditApproveAction } from "./credit-hold/CreditApproveAction";
import { CreditRejectAction } from "./credit-hold/CreditRejectAction";
import { DANGER_ORDER, holdGuidanceFor, noActionReason, PRIMARY_ORDER } from "./order-action-rules";
import { OrderCancelAction } from "./OrderCancelAction";
import { OrderCreateTaskLink } from "./OrderCreateTaskLink";
import { OrderHoldNotice } from "./OrderHoldNotice";
import { OrderNextStep } from "./OrderNextStep";
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
import type { Order } from "../types";

interface OrderActionCardProps {
  order: Order;
  can: (code: PermissionCode) => boolean;
  /** Khe "Ước tính xếp xe" trong hộp thoại release (xem `estimate-slot.ts`). */
  estimateSlot?: OrderEstimateSlot;
}

/**
 * Thao tác của đơn trên header đối tượng (backoffice-erp-ui B10): nút xếp thành hàng bên phải, dưới là việc tiếp theo,
 * thông báo tạm giữ, lý do chưa release được. Trạng thái nằm ở dòng mã đơn của header nên không lặp lại ở đây.
 * Nút do `allowedOrderActions` quyết MỘT lần (trạng thái + mã quyền + ngữ cảnh đơn: lý do giữ, đã chia
 * lô, đã đóng gói, giữ công nợ) — không rải điều kiện vòng đời trong JSX.
 * UI-only gating — Backend phải re-check (bảng chuyển trạng thái BE PR #133, OrderReleaseService,
 * CreditHoldService, Order#requireNotPacked).
 */
export function OrderActionCard({ order, can, estimateSlot }: OrderActionCardProps) {
  const canRelease = can(ORDER_PERMISSIONS.release);
  // BE tính `onSigningPaid` từ mọi đợt ON_SIGNING. Quản lý kho thiếu quyền đọc installments vẫn cần lời giải thích.
  const payment = useOrderInstallmentsSummary(order.orderId, {
    enabled:
      canRelease && can(PAYMENT_INSTALLMENT_PERMISSIONS.read) && order.status === "Pending Payment",
  });
  const actions = allowedOrderActions(order.status, can, orderActionContextOf(order));
  const has = (code: OrderActionCode) => actions.some((a) => a.code === code);
  const onHold = order.status === "On Hold";
  // Giữ do hệ thống: nói rõ phải xử lý ở đâu thay vì để người dùng tìm nút "Gỡ giữ" không có
  const holdGuidance =
    onHold && !has("resolve-hold") && !has("credit-approve") ? holdGuidanceFor(order, can) : null;
  const shipmentsHint =
    order.shipments.length > 0 &&
    (order.status === "Shipped" || order.status === "Partially Fulfilled") &&
    can(FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS.approve)
      ? ORDER_ACTION_LABELS.shipmentsHint
      : null;
  const guidance = holdGuidance ?? shipmentsHint;
  // Lý do biết trước chưa ra lệnh xuất kho được: chỉ cho người có quyền release; nói ra thay vì ẩn nút.
  // UI-only — Backend phải re-check (docs 07 BR-01, 15 BR-07, 17 BR-02).
  const blockers = canRelease ? releaseBlockers(order, payment.data) : [];
  // Đơn đã có lệnh xuất kho mà chưa có nhiệm vụ lấy hàng: việc tiếp theo là tạo nhiệm vụ (quản lý kho của kho xuất)
  const createTaskHref = createPickingTaskHref(order, can);
  // MỘT nút chính theo việc tiếp theo; còn lại vào menu "⋯" — việc thường trước, việc phá huỷ (chữ đỏ) cuối
  const primary = createTaskHref ? undefined : PRIMARY_ORDER.find(has);
  const menuCodes = [...PRIMARY_ORDER, ...DANGER_ORDER].filter(
    (code) => has(code) && code !== primary,
  );
  const render = (code: OrderActionCode) => {
    switch (code) {
      case "release":
        return <OrderReleaseAction order={order} can={can} estimateSlot={estimateSlot} />;
      case "credit-approve":
        return <CreditApproveAction order={order} />;
      case "resolve-hold":
        return <OrderResolveHoldAction order={order} />;
      case "delivery-failure":
        return <OrderDeliveryFailureAction order={order} />;
      case "hold":
        return <OrderHoldAction order={order} />;
      case "credit-reject":
        return <CreditRejectAction order={order} />;
      case "remainder-closure":
        return <OrderRemainderClosureAction order={order} />;
      case "admin-cancel":
        return <OrderCancelAction order={order} />;
      default:
        return null;
    }
  };

  return (
    <section
      aria-label="Thao tác đơn"
      className="flex w-full max-w-xl flex-col gap-2 text-left lg:items-end lg:text-right"
    >
      {(actions.length > 0 || createTaskHref) && (
        <ObjectActions
          menuLabel="Thao tác khác với đơn hàng"
          hasMenu={menuCodes.length > 0}
          primary={
            createTaskHref ? (
              <OrderCreateTaskLink href={createTaskHref} />
            ) : primary ? (
              render(primary)
            ) : undefined
          }
        >
          {menuCodes.map((code) => (
            <Fragment key={code}>{render(code)}</Fragment>
          ))}
        </ObjectActions>
      )}
      <OrderNextStep status={order.status} />
      {onHold && <OrderHoldNotice order={order} />}
      {blockers.length > 0 && (
        <div className="border-border-default bg-bg-subtle rounded-[var(--r-sm)] border px-3 py-2 text-left text-xs">
          <p className="text-ink-primary font-medium">{ORDER_RELEASE_BLOCKER_LABELS.title}</p>
          <ul className="text-ink-secondary mt-1 space-y-0.5">
            {blockers.map((blocker) => (
              <li key={blocker.rule}>{blocker.message}</li>
            ))}
          </ul>
        </div>
      )}
      {guidance && <p className="text-ink-secondary text-xs">{guidance}</p>}
      {actions.length === 0 && blockers.length === 0 && !guidance && !createTaskHref && (
        // Không hiện chữ trên header (nút "⋯" / nút chính đã đủ); screen reader vẫn được nghe vì sao không có thao tác
        <p className="sr-only">{noActionReason(order, can)}</p>
      )}
    </section>
  );
}
