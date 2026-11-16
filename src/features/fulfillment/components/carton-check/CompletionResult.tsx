"use client";

import { PACK_STATUS, UI_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format/money";
import { Alert } from "@/components/shared/Alert";

import { MONO } from "../primitives";

import type { CartonCheckSession } from "@/features/fulfillment/carton-check-types";
import type { FulfillmentTask } from "@/features/fulfillment/types";

const C = UI_LABELS.cartonCheck.complete;
const N = UI_LABELS.cartonCheck.notice;

/**
 * Kết quả sau khi hoàn tất: shipment vừa tạo, kèm cảnh báo thu tiền. `paymentDue` của câu trả lời hoàn tất chỉ là cảnh
 * báo (docs 08 §4.4 bước 9, BR-11): hoàn tất vẫn thành công, bàn giao mới bị chặn tới khi đợt BEFORE_DELIVERY đã thu.
 */
export function CompletionResult({
  session,
  task,
}: {
  session: CartonCheckSession;
  task: FulfillmentTask;
}) {
  const shipment = session.shipments.find((candidate) => candidate.shipmentId === task.shipmentId);
  const due = task.paymentDue;
  return (
    <div className="space-y-3">
      <Alert tone="info" title={C.resultTitle}>
        {shipment ? (
          <>
            <span className={MONO}>{shipment.code}</span> · {C.resultCartons(shipment.packageCount)}
            .{" "}
          </>
        ) : (
          <>{C.resultLoading} </>
        )}
        {task.packStatus === PACK_STATUS.COMPLETED ? C.resultFull : C.resultPartial}
      </Alert>
      {due && due.amountDueBeforeHandover > 0 && (
        <Alert tone="warning" title={N.paymentTitle}>
          {N.paymentDescription(formatMoney(due.amountDueBeforeHandover, due.currency))}
        </Alert>
      )}
    </div>
  );
}
