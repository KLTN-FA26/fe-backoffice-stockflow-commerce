"use client";

import { UI_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format/money";
import { Alert } from "@/components/shared/Alert";
import { removedCartons } from "@/features/fulfillment/carton-check-selectors";

import type { CartonCheckAccess } from "@/features/fulfillment/carton-check-lifecycle";
import type { CartonCheckSession } from "@/features/fulfillment/carton-check-types";

const N = UI_LABELS.cartonCheck.notice;

/**
 * Các thông báo đầu trạm: phiên đang do người khác kiểm (tên lấy từ phiên — `PACKING_TAKEN` của BE không kèm tên), đơn
 * đã khoá từ thùng đầu tiên dán nhãn (BR-04), SKU thiếu quy cách thùng (BR-07), thùng đã bị loại, khoản phải thu trước
 * khi giao (BR-11 — chỉ cảnh báo) và hướng dẫn bắt đầu.
 */
export function CartonCheckNotices({
  session,
  access,
  waitingPick,
}: {
  session: CartonCheckSession;
  access: CartonCheckAccess;
  /** Lấy hàng chưa xong / thùng còn ở khu chờ xuất → chưa bắt đầu kiểm được (BE `PACKING_NOT_READY`). */
  waitingPick: boolean;
}) {
  const starter = session.startedByName ?? undefined;
  const due = session.paymentDue;
  const removed = removedCartons(session);
  return (
    <>
      {access.takenByOther && (
        <Alert tone="warning" title={starter ? N.takenTitle(starter) : N.takenAnonymous}>
          {N.takenDescription}
        </Alert>
      )}
      {access.managerAssist && (
        <Alert tone="info" title={starter ? N.managerTitle(starter) : N.takenAnonymous}>
          {N.managerDescription}
        </Alert>
      )}
      {waitingPick && (
        <Alert tone="info" title={UI_LABELS.cartonCheck.status.pick}>
          {N.waitingPick}
        </Alert>
      )}
      {access.canStart && !waitingPick && <Alert tone="info">{N.pendingStart}</Alert>}
      {session.orderLocked && (
        <Alert tone="info" title={N.lockedTitle}>
          {N.lockedDescription}
        </Alert>
      )}
      {session.skusWithoutCartonSpec.length > 0 && (
        <Alert tone="warning" title={N.unmeasuredTitle}>
          {N.unmeasuredDescription(session.skusWithoutCartonSpec.join(", "))}
        </Alert>
      )}
      {removed.length > 0 && (
        <Alert tone="info" title={N.removedTitle}>
          {N.removedDescription(removed.map((carton) => carton.lpn).join(", "))}
        </Alert>
      )}
      {due && due.amount > 0 && (
        <Alert tone="warning" title={N.paymentTitle}>
          {N.paymentDescription(formatMoney(due.amount, due.currency))}
        </Alert>
      )}
    </>
  );
}
