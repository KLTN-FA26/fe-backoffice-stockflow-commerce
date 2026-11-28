"use client";

import Link from "next/link";

import { ADMIN_ROUTES, LOAD_PLAN_PERMISSIONS, PACK_STATUS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { formatMoney } from "@/lib/format/money";
import { Alert } from "@/components/shared/Alert";

import { MONO } from "../primitives";
import { PaymentDueLink } from "./PaymentDueLink";

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
  // Việc kế tiếp của lô vừa tạo là lập kế hoạch xếp xe (docs 09) — người có quyền lập đi tiếp một chạm.
  // UI-only — Backend phải re-check (fulfillment-load-plans:CREATE)
  const canPlan = useCan(LOAD_PLAN_PERMISSIONS.create);
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
      {canPlan && shipment && (
        <Link
          href={ADMIN_ROUTES.loadPlans.create}
          className="bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse inline-flex h-11 items-center justify-center rounded-[var(--r-sm)] px-4 text-sm font-medium"
        >
          {C.planLoad}
        </Link>
      )}
      {due && due.amountDueBeforeHandover > 0 && (
        <Alert tone="warning" title={N.paymentTitle}>
          {N.paymentDescription(formatMoney(due.amountDueBeforeHandover, due.currency))}
          <PaymentDueLink orderId={session.orderId} />
        </Alert>
      )}
    </div>
  );
}
