import { DELIVERY_FAILURE_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format";
import { formatDateTime } from "@/lib/format/date";

import { allowedDeliveryFailureActions, showsDecisionNote } from "../../delivery-failure-lifecycle";

import { CancelUndeliveredAction } from "./CancelUndeliveredAction";
import { DeliveryFailureStatus, failureReasonLabel } from "./DeliveryFailureStatus";

import type { PermissionCode } from "@/lib/auth";
import type { DeliveryFailureCase } from "../../delivery-failure-schemas";
import type { Order } from "../../types";

const L = DELIVERY_FAILURE_LABELS.section;

/**
 * Một hồ sơ hàng hoàn về trong khối của chi tiết đơn: phiếu nhận hàng hoàn, lý do, số hàng về, quyết định; nút "Huỷ phần
 * chưa giao" chỉ cho đơn cũ còn giữ vì giao thất bại (`allowedDeliveryFailureActions`).
 */
export function DeliveryFailureCaseItem({
  failure,
  order,
  can,
}: {
  failure: DeliveryFailureCase;
  order: Pick<Order, "status" | "holdReason" | "currency">;
  can: (code: PermissionCode) => boolean;
}) {
  const actions = allowedDeliveryFailureActions(failure, order, can);
  const units = failure.lines.reduce((sum, line) => sum + line.units, 0);
  const held = failure.lines.reduce((sum, line) => sum + line.heldUnits, 0);
  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium">
          {failure.receiptNumber ? L.receipt(failure.receiptNumber) : "—"}
        </span>
        <DeliveryFailureStatus failure={failure} />
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[0.8125rem]">
        <dt className="text-ink-secondary">{DELIVERY_FAILURE_LABELS.columns.reason}</dt>
        <dd className="text-ink-primary">{failureReasonLabel(failure.failureReason)}</dd>
        {failure.failureNote && (
          <>
            <dt className="text-ink-secondary">{L.failureNote}</dt>
            <dd className="text-ink-primary break-words">{failure.failureNote}</dd>
          </>
        )}
        <dt className="text-ink-secondary">{DELIVERY_FAILURE_LABELS.columns.openedAt}</dt>
        <dd className="text-ink-primary tabular-nums">{formatDateTime(failure.openedAt)}</dd>
        {failure.lines.length > 0 && (
          <>
            <dt className="text-ink-secondary">{L.cartons(failure.cartons.length)}</dt>
            <dd className="text-ink-primary tabular-nums">{L.units(units, held)}</dd>
          </>
        )}
        {showsDecisionNote(failure) && (
          <>
            <dt className="text-ink-secondary">{L.decisionNote}</dt>
            <dd className="text-ink-primary break-words">{failure.decisionNote}</dd>
          </>
        )}
        {failure.failedTripFee !== null && (
          <>
            <dt className="text-ink-secondary">{L.failedTripFee}</dt>
            <dd className="text-ink-primary font-mono tabular-nums">
              {formatMoney(failure.failedTripFee, order.currency)}
            </dd>
          </>
        )}
      </dl>
      {failure.carrierClaim && <p className="text-ink-secondary text-xs">{L.carrierClaim}</p>}
      {failure.readyForRelease && <p className="text-ink-secondary text-xs">{L.readyForRelease}</p>}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.includes("cancel-undelivered") && (
            <CancelUndeliveredAction
              compact
              target={{
                orderId: failure.orderId,
                orderNumber: failure.orderNumber,
                caseId: failure.caseId,
              }}
            />
          )}
        </div>
      )}
    </li>
  );
}
