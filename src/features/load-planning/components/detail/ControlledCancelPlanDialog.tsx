"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { loadPlanErrorMessage } from "@/features/load-planning/errors";
import { controlledPlanCancelSchema } from "@/features/load-planning/input-schemas";
import { useCancelPlanControlled } from "@/features/load-planning/mutations";
import { useLoadPlan } from "@/features/load-planning/queries";
import { ControlledCancelDialog } from "@/components/backoffice/ControlledCancelDialog";

import type { ControlledCancelValues } from "@/components/backoffice/ControlledCancelDialog";
import type { PlanDetail } from "@/features/load-planning/plan-types";

const C = UI_LABELS.shipping.ftl.controlledCancel.plan;

/**
 * Huỷ có kiểm soát CẢ kế hoạch sau khi đã bắt đầu xếp hàng (SCRUM-474 UNLOAD-DESIGN điểm 1, 3, 4, 7; docs 09 BR-14): kế hoạch
 * CANCELLED ngay, kiện đã quét bị khoá tới khi dỡ; không mở lại được. Gửi `expectedVersion` của bản MỚI NHẤT như mọi bước
 * của kế hoạch. Backend phải re-check quyền (`fulfillment-controlled-cancellations:UPDATE`) và việc đã có xe rời kho.
 */
export function ControlledCancelPlanDialog({
  plan,
  onClose,
}: {
  plan: PlanDetail;
  onClose: () => void;
}) {
  const cancel = useCancelPlanControlled();
  const current = useLoadPlan(plan.loadPlanId).data ?? plan;
  const [error, setError] = useState<string | null>(null);

  const submit = (values: ControlledCancelValues) => {
    const parsed = controlledPlanCancelSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setError(null);
    cancel.mutate(
      { loadPlanId: current.loadPlanId, expectedVersion: current.version, ...parsed.data },
      { onSuccess: onClose, onError: (e) => setError(loadPlanErrorMessage(e)) },
    );
  };

  return (
    <ControlledCancelDialog
      title={`${C.title} ${current.code}`}
      description={C.description}
      confirmLabel={C.confirm}
      loading={cancel.isPending}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    />
  );
}
