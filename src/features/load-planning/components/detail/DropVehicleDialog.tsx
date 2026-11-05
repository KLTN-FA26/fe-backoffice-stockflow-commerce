"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { loadPlanErrorMessage } from "@/features/load-planning/errors";
import { controlledPlanCancelSchema } from "@/features/load-planning/input-schemas";
import { useDropVehicleFromPlan } from "@/features/load-planning/mutations";
import { ControlledCancelDialog } from "@/components/backoffice/ControlledCancelDialog";

import type { ControlledCancelValues } from "@/components/backoffice/ControlledCancelDialog";
import type { PlanVehicle } from "@/features/load-planning/plan-types";

const C = UI_LABELS.shipping.ftl.controlledCancel.drop;

/**
 * Bỏ MỘT xe chưa xếp hàng khỏi kế hoạch khi mọi xe còn lại đã rời kho (SCRUM-474 UNLOAD-DROP; docs 09 BR-14, BR-15): chọn mã lý
 * do + ghi chú (bắt buộc, như mọi lần huỷ có kiểm soát). Chuyến của xe bị huỷ, các kiện xếp trên xe chờ kế hoạch mới. Backend
 * phải re-check quyền (`fulfillment-controlled-cancellations:UPDATE`), trạng thái xe và việc xe còn chở kiện của lô đã đi.
 */
export function DropVehicleDialog({
  vehicle,
  onClose,
}: {
  vehicle: PlanVehicle;
  onClose: () => void;
}) {
  const drop = useDropVehicleFromPlan();
  const [error, setError] = useState<string | null>(null);
  const loadId = vehicle.load?.loadId;

  const submit = (values: ControlledCancelValues) => {
    const parsed = controlledPlanCancelSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    // Chỉ xe có chuyến PLANNED mới được bỏ (`dropVehicleSeqs`): không có chuyến thì không có gì để gửi
    if (!loadId) return;
    setError(null);
    drop.mutate(
      { loadId, ...parsed.data },
      { onSuccess: onClose, onError: (e) => setError(loadPlanErrorMessage(e)) },
    );
  };

  return (
    <ControlledCancelDialog
      title={`${C.title} ${vehicle.seq}`}
      description={C.description}
      confirmLabel={C.confirm}
      loading={drop.isPending}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    />
  );
}
