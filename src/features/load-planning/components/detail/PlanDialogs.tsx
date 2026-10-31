"use client";

import { ControlledCancelPlanDialog } from "./ControlledCancelPlanDialog";
import { EditInputsDialog } from "./EditInputsDialog";
import { PlanStepDialog } from "./PlanStepDialog";

import type { PlanDetail } from "@/features/load-planning/plan-types";
import type { PlanDialogKind } from "./PlanActions";

/** Hộp thoại đang mở của trang chi tiết (không có = không hiện gì). */
export function PlanDialogs({
  plan,
  dialog,
  onClose,
}: {
  plan: PlanDetail;
  dialog: PlanDialogKind | null;
  onClose: () => void;
}) {
  if (!dialog) return null;
  if (dialog === "editInputs") return <EditInputsDialog plan={plan} onClose={onClose} />;
  if (dialog === "cancelControlled")
    return <ControlledCancelPlanDialog plan={plan} onClose={onClose} />;
  return <PlanStepDialog plan={plan} kind={dialog} onClose={onClose} />;
}
