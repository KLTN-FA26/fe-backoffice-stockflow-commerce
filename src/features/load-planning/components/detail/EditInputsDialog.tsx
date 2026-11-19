"use client";

import { useState } from "react";

import { UI_LABELS, VEHICLE_TYPE_STATUS } from "@/constants";
import { loadPlanErrorMessage } from "@/features/load-planning/errors";
import { planInputsSchema } from "@/features/load-planning/input-schemas";
import { useSetLoadPlanInputs } from "@/features/load-planning/mutations";
import {
  candidateKey,
  fillLineOptions,
  fillLinesToSend,
} from "@/features/load-planning/plan-selectors";
import {
  useActiveVehicleTypes,
  useLoadPlan,
  useLoadPlanCandidates,
} from "@/features/load-planning/queries";
import { Alert } from "@/components/shared/Alert";
import { DialogScrollArea } from "@/components/shared/DialogScrollArea";
import { FormDialogBody } from "@/components/shared/FormDialog";
import { LayeredDialogContent } from "@/components/shared/LayeredDialogContent";
import { Dialog } from "@/components/ui/dialog";

import { PlanInputsFields } from "../create/PlanInputsFields";
import { usePlanInputsState } from "../create/usePlanInputsState";

import type { PlanDetail } from "@/features/load-planning/plan-types";

const D = UI_LABELS.loadPlan.dialog.editInputs;

/**
 * Đổi đầu vào của kế hoạch (docs 09 §4.2 bước 3, "đổi kiện"): lô, loại xe, chế độ — `PUT …/inputs` thay nguyên cả ba,
 * kế hoạch đã tính về bản nháp và bỏ các xe. Danh sách lô tính kiện của chính kế hoạch là còn trống (`loadPlanId`).
 * Gửi `expectedVersion` của bản mới nhất, lỗi hiện ngay trong hộp thoại.
 */
export function EditInputsDialog({ plan, onClose }: { plan: PlanDetail; onClose: () => void }) {
  const update = useSetLoadPlanInputs();
  const current = useLoadPlan(plan.loadPlanId).data ?? plan;
  // Loại xe đã ngừng dùng không có ô trong danh sách chọn (chỉ liệt kê loại ACTIVE) nên không đưa vào lựa chọn ban
  // đầu: BE từ chối cả request (409 VEHICLE_TYPE_INACTIVE) nếu còn gửi lại id đó mà người dùng không bỏ chọn được.
  const inactive = plan.vehicleTypes.filter((t) => t.status !== VEHICLE_TYPE_STATUS.ACTIVE);
  const inputs = usePlanInputsState({
    shipmentIds: plan.shipments.map((s) => s.shipmentId),
    vehicleTypeIds: plan.vehicleTypes
      .filter((t) => t.status === VEHICLE_TYPE_STATUS.ACTIVE)
      .map((t) => t.vehicleTypeId),
    selectionMode: plan.selectionMode,
    // Dòng đơn của các kiện đang là hàng chèn (RTM-LPGROUP)
    fillOrderLineIds: [
      ...new Set(plan.packages.flatMap((p) => (p.fill && p.orderLineId ? [p.orderLineId] : []))),
    ],
  });
  const candidates = useLoadPlanCandidates(plan.warehouseId, plan.loadPlanId);
  const types = useActiveVehicleTypes();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const knownShipments = new Set(candidates.data?.map(candidateKey));
    const knownTypes = new Set(types.data?.map((t) => t.vehicleTypeId));
    const vehicleTypeIds = [...inputs.vehicleTypes].filter((id) => knownTypes.has(id));
    const base = { loadPlanId: current.loadPlanId, expectedVersion: current.version };
    const callbacks = {
      onSuccess: onClose,
      onError: (e: unknown) => setError(loadPlanErrorMessage(e)),
    };
    const shipmentIds = [...inputs.shipments].filter((id) => knownShipments.has(id));
    const parsed = planInputsSchema.safeParse({
      shipmentIds,
      vehicleTypeIds,
      selectionMode: inputs.mode,
      fillOrderLineIds: fillLinesToSend(
        inputs.mode,
        inputs.fillLines,
        fillLineOptions(candidates.data ?? [], new Set(shipmentIds)),
      ),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setError(null);
    update.mutate({ ...base, ...parsed.data }, callbacks);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !update.isPending && onClose()}>
      <LayeredDialogContent className="border-border-default bg-bg-surface gap-0 rounded-[var(--r-xl)] border p-0 shadow-[var(--sh-lg)] ring-0 sm:max-w-5xl">
        <FormDialogBody
          title={`${D.title} ${current.code}`}
          description={D.description}
          submitLabel={D.confirm}
          canSubmit
          isPending={update.isPending}
          error={error}
          onSubmit={submit}
          onCancel={onClose}
        >
          <DialogScrollArea>
            {inactive.length > 0 && (
              <Alert tone="warning">
                {D.inactiveDropped(inactive.map((t) => t.code).join(", "))}
              </Alert>
            )}
            <PlanInputsFields
              idPrefix="lp-edit"
              warehouseId={current.warehouseId}
              candidates={candidates}
              types={types}
              inputs={inputs}
            />
          </DialogScrollArea>
        </FormDialogBody>
      </LayeredDialogContent>
    </Dialog>
  );
}
