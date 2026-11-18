"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { loadPlanErrorMessage } from "@/features/load-planning/errors";
import { useRemoveShipmentFromPlan } from "@/features/load-planning/mutations";
import { useLoadPlan } from "@/features/load-planning/queries";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import type { PlanDetail } from "@/features/load-planning/plan-types";

const D = UI_LABELS.loadPlan.dialog.removeShipment;
const KEEP = UI_LABELS.loadPlan.dialog.keepOpen;

/**
 * Gỡ MỘT lô giao khỏi kế hoạch PLANNED (docs 09 §4.2 bước 9, RTM 09A-158): chọn lô rồi xác nhận. Kiện của lô về khu chờ
 * xuất; chỉ xe từng chở lô đó đổi — xe trống rời kế hoạch, xe còn kiện khác hiện "Cần tính lại". Gửi `expectedVersion` của
 * bản mới nhất (sau 409 mutation đã tải lại kế hoạch). Backend re-check trạng thái và quyền.
 */
export function RemoveShipmentDialog({ plan, onClose }: { plan: PlanDetail; onClose: () => void }) {
  const remove = useRemoveShipmentFromPlan();
  const current = useLoadPlan(plan.loadPlanId).data ?? plan;
  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chosen = current.shipments.some((s) => s.shipmentId === shipmentId) ? shipmentId : null;

  const submit = () => {
    if (!chosen) {
      setError(D.required);
      return;
    }
    setError(null);
    remove.mutate(
      { loadPlanId: current.loadPlanId, expectedVersion: current.version, shipmentId: chosen },
      { onSuccess: onClose, onError: (e: unknown) => setError(loadPlanErrorMessage(e)) },
    );
  };

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && !remove.isPending && onClose()}
      title={`${D.title} ${current.code}`}
      description={D.description}
      confirmLabel={D.confirm}
      cancelLabel={KEEP}
      variant="danger"
      loading={remove.isPending}
      closeOnConfirm={false}
      error={error}
      onConfirm={submit}
    >
      <fieldset className="grid gap-2">
        <legend className="text-ink-secondary mb-1 text-[0.8125rem] font-medium">{D.pick}</legend>
        {current.shipments.map((s) => {
          const id = `remove-shipment-${s.shipmentId}`;
          return (
            <label
              key={s.shipmentId}
              htmlFor={id}
              className="border-border-default bg-bg-surface hover:bg-bg-subtle has-[:checked]:border-brand flex cursor-pointer items-center gap-2 rounded-[var(--r-sm)] border p-2.5 text-[0.8125rem]"
            >
              <input
                id={id}
                type="radio"
                name="remove-shipment"
                value={s.shipmentId}
                checked={chosen === s.shipmentId}
                onChange={() => setShipmentId(s.shipmentId)}
                className="accent-brand"
              />
              <span className="text-ink-primary">
                {D.option(s.code, s.orderNumber ?? "—", s.packageCount)}
              </span>
            </label>
          );
        })}
      </fieldset>
    </ConfirmDialog>
  );
}
