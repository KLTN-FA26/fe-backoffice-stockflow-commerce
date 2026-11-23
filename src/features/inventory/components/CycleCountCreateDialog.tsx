"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { WORKSPACE_PATHS } from "@/constants";
import { CYCLE_COUNT_CREATE_LABELS } from "@/constants/cycle-count";
import { CYCLE_COUNT_PERMISSIONS } from "@/constants/permissions";

import { useCan } from "@/lib/auth";
import { useWarehouseZones } from "@/lib/references/warehouse-layout";
import { useWorkspaceHref, useWorkspaceWarehouse } from "@/lib/workspace";

import { DialogScrollArea } from "@/components/shared/DialogScrollArea";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { initialPlanForm, toPlanInput } from "../cycle-count-plan-form";
import { planCycleCountError } from "../cycle-count-errors";
import { usePlanCycleCount } from "../cycle-count-mutations";
import { useCycleCountAssignees } from "../cycle-count-queries";
import { planCycleCountInput } from "../cycle-count-schemas";
import { CycleCountPlanOptions } from "./CycleCountPlanOptions";
import { CycleCountScopeFields } from "./CycleCountScopeFields";

import type { PlanFormValues } from "../cycle-count-plan-form";

const C = CYCLE_COUNT_CREATE_LABELS;

/**
 * Lập phiếu kiểm kê tay (BE `POST /inventory/cycle-counts`, docs 20 §3, §4.2 a, BR-12): kho, phạm vi (khu, kệ, vị trí,
 * SKU — ít nhất một, tối đa 500 thùng do BE kiểm), người đếm, kiểm mù (mặc định có), ngày kiểm (mặc định hôm nay) và
 * ghi chú. Lập xong mở phiếu mới; thùng bị bỏ qua vì đang nằm trên phiếu khác thì báo số lượng.
 */
export function CycleCountCreateDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const canCreate = useCan(CYCLE_COUNT_PERMISSIONS.create);
  const plan = usePlanCycleCount();
  // Kho cố định = kho của tab theo kho (spec 2026-11-22 §5.8) — không cho chọn kho khác
  const warehouse = useWorkspaceWarehouse();
  const href = useWorkspaceHref();
  const [values, setValues] = useState<PlanFormValues>(() => initialPlanForm(warehouse.id));
  const [error, setError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const zones = useWarehouseZones(values.warehouseId);
  const assignees = useCycleCountAssignees(values.warehouseId, canCreate);

  const edit = (patch: Partial<PlanFormValues>) => {
    setValues((previous) => ({ ...previous, ...patch }));
    setError(undefined);
    setServerError(null);
  };

  const submit = () => {
    const parsed = planCycleCountInput.safeParse(toPlanInput(values));
    if (!parsed.success) {
      setError(values.warehouseId ? parsed.error.issues[0]?.message : C.warehouseRequired);
      return;
    }
    // The flat form values: the request body (with its `scope` object) is made when it is sent
    plan.mutate(toPlanInput(values), {
      onSuccess: ({ count }) => {
        onClose();
        router.push(href(WORKSPACE_PATHS.cycleCount(count.id)));
      },
      onError: (failure) => setServerError(planCycleCountError(failure).detail),
    });
  };

  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={C.title}
        description={C.description}
        submitLabel={C.action}
        canSubmit={canCreate && Boolean(values.warehouseId)}
        isPending={plan.isPending}
        error={serverError}
        onSubmit={submit}
        onCancel={onClose}
      >
        <DialogScrollArea>
          <p className="text-ink-secondary text-[0.8125rem]">
            {C.warehouse}:{" "}
            <span className="text-ink-primary font-medium">
              {warehouse.prefix} · {warehouse.name}
            </span>
          </p>
          <CycleCountScopeFields
            values={values}
            zones={zones.data ?? []}
            error={error}
            onChange={edit}
          />
          <CycleCountPlanOptions values={values} assignees={assignees.data ?? []} onChange={edit} />
        </DialogScrollArea>
      </FormDialogBody>
    </FormDialog>
  );
}
