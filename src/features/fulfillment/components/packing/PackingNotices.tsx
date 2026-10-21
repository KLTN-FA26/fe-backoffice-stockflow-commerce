"use client";

import { UI_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format/money";
import { Alert } from "@/components/shared/Alert";

import type { PackingAccess } from "@/features/fulfillment/packing-lifecycle";
import type { PackingSession } from "@/features/fulfillment/packing-types";

const N = UI_LABELS.packing.notice;
const { fulfillment } = UI_LABELS;

/**
 * Các thông báo đầu trạm: bị giữ do lệch thiết kế, đơn đang do người khác đóng (tên lấy từ phiên —
 * `PACKING_TAKEN` của BE không kèm tên), khoản phải thu trước bàn giao (G3-Q4) và hướng dẫn bắt đầu.
 */
export function PackingNotices({
  session,
  access,
  waitingPick,
}: {
  session: PackingSession;
  access: PackingAccess;
  waitingPick: boolean;
}) {
  const owner = session.packerName ?? undefined;
  const due = session.paymentDue;
  return (
    <>
      {session.packStatus === "On Hold" && (
        <Alert tone="danger" title={fulfillment.holdTitle}>
          {N.holdDescription} {!access.canReverify && N.holdReadOnly}
        </Alert>
      )}
      {access.takenByOther && (
        <Alert tone="warning" title={owner ? N.takenTitle(owner) : N.takenAnonymous}>
          {N.takenDescription}
        </Alert>
      )}
      {access.managerAssist && (
        <Alert tone="info" title={owner ? N.managerTitle(owner) : N.takenAnonymous}>
          {N.managerDescription}
        </Alert>
      )}
      {access.canStart && !waitingPick && <Alert tone="info">{N.pendingStart}</Alert>}
      {due && due.amountDueBeforeHandover > 0 && (
        <Alert tone="warning" title={N.paymentTitle}>
          {N.paymentDescription(formatMoney(due.amountDueBeforeHandover, due.currency))}
        </Alert>
      )}
    </>
  );
}
