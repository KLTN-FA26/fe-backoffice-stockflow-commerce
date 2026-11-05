"use client";

import { useState } from "react";

import { LOAD_PLAN_LIMITS, UI_LABELS } from "@/constants";
import { loadPlanErrorMessage } from "@/features/load-planning/errors";
import { planReasonSchema } from "@/features/load-planning/input-schemas";
import { usePlanStep } from "@/features/load-planning/mutations";
import { useLoadPlan } from "@/features/load-planning/queries";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import type { PlanDetail, PlanStepKind } from "@/features/load-planning/plan-types";

const D = UI_LABELS.loadPlan.dialog;

const COPY = {
  calculate: {
    title: D.calculate.title,
    description: D.calculate.description,
    confirm: D.calculate.confirm,
  },
  acknowledge: {
    title: D.acknowledge.title,
    description: D.acknowledge.description,
    confirm: D.acknowledge.confirm,
  },
  confirm: {
    title: D.confirm.title,
    description: D.confirm.description,
    confirm: D.confirm.confirm,
  },
  reopen: { title: D.reopen.title, description: D.reopen.description, confirm: D.reopen.confirm },
  cancel: { title: D.cancel.title, description: D.cancel.description, confirm: D.cancel.confirm },
} as const satisfies Record<PlanStepKind, { title: string; description: string; confirm: string }>;

/**
 * Hộp thoại xác nhận một bước đổi trạng thái (tính, để lại kiện chưa xếp, chốt, mở lại, huỷ) ngay trong trang — mở lại
 * và huỷ bắt buộc lý do (BE `LoadPlanReasonRequest`, LP-11). Gửi `expectedVersion` của bản MỚI NHẤT: sau 409
 * OPTIMISTIC_LOCK mutation đã tải lại kế hoạch, bấm xác nhận lần nữa gửi đúng version mới thay vì bản chụp lúc mở.
 */
export function PlanStepDialog({
  plan,
  kind,
  onClose,
}: {
  plan: PlanDetail;
  kind: PlanStepKind;
  onClose: () => void;
}) {
  const step = usePlanStep();
  const current = useLoadPlan(plan.loadPlanId).data ?? plan;
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[kind];
  const needsReason = kind === "reopen" || kind === "cancel";
  const finish = {
    onSuccess: onClose,
    onError: (e: unknown) => setError(loadPlanErrorMessage(e)),
  };

  const submit = (reason?: string) => {
    setError(null);
    const base = { loadPlanId: current.loadPlanId, expectedVersion: current.version };
    if (kind === "reopen" || kind === "cancel") {
      const parsed = planReasonSchema.safeParse({ reason });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? null);
        return;
      }
      step.mutate({ kind, ...base, reason: parsed.data.reason }, finish);
      return;
    }
    step.mutate({ kind, ...base }, finish);
  };

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && !step.isPending && onClose()}
      title={`${copy.title} ${current.code}`}
      description={copy.description}
      confirmLabel={copy.confirm}
      cancelLabel={D.keepOpen}
      variant={kind === "cancel" ? "danger" : "default"}
      requireReason={needsReason}
      reasonLabel={kind === "reopen" ? D.reopen.reason : D.cancel.reason}
      reasonMaxLength={LOAD_PLAN_LIMITS.reasonMax}
      loading={step.isPending}
      closeOnConfirm={false}
      error={error}
      onConfirm={submit}
    />
  );
}
