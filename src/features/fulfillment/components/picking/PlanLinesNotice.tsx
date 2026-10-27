"use client";

import { Loader2 } from "lucide-react";

import { PICK_LINE_LABELS } from "@/constants";
import { fulfillmentErrorMessage } from "@/features/fulfillment/errors";
import { usePlanPickLines } from "@/features/fulfillment/pick-line-mutations";
import { Alert } from "@/components/shared/Alert";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

const L = PICK_LINE_LABELS;

/**
 * Task đang lấy hàng mà chưa có dòng (bắt đầu trước khi BE có dòng lấy hàng): người được gán bấm để BE lập
 * dòng (`POST …/picking-start` lần nữa → `planLines`). Người khác chỉ thấy câu báo.
 */
export function PlanLinesNotice({ taskId, canPlan }: { taskId: string; canPlan: boolean }) {
  const plan = usePlanPickLines();
  return (
    <Alert tone="warning" title={L.linesNotPlanned}>
      {canPlan ? (
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={plan.isPending}
          onClick={() =>
            plan.mutate(taskId, {
              onError: (error) => toast.error(fulfillmentErrorMessage(error, "pick")),
            })
          }
          className="border-border-default mt-1 rounded-[var(--r-sm)]"
        >
          {plan.isPending && <Loader2 className="size-3.5 animate-spin" />}
          {L.planLines}
        </Button>
      ) : null}
    </Alert>
  );
}
