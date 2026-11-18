"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { CYCLE_COUNT_CREATE_LABELS, CYCLE_COUNT_ROUTES } from "@/constants/cycle-count";
import { CYCLE_COUNT_PERMISSIONS } from "@/constants/permissions";

import { useCan } from "@/lib/auth";
import { useWarehouseZones } from "@/lib/references/warehouse-layout";
import { useWarehouseOptions } from "@/lib/references/warehouse-options";
import { useAppStore } from "@/lib/store/use-app-store";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { toast } from "@/components/shared/Toast";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const current = useAppStore((state) => state.warehouseId);
  const warehouses = useWarehouseOptions();
  const [values, setValues] = useState<PlanFormValues>(() => initialPlanForm(current ?? ""));
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
    plan.mutate(parsed.data, {
      onSuccess: ({ count, skipped }) => {
        toast.success(C.planned(count.countNumber));
        if (skipped.length > 0) toast.warning(C.skipped(skipped.length));
        onClose();
        router.push(CYCLE_COUNT_ROUTES.detail(count.id));
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
        <FormField id="plan-warehouse" label={C.warehouse} required>
          <Select
            value={values.warehouseId}
            onValueChange={(warehouseId) => edit({ warehouseId, zoneIds: [], assignedUserId: "" })}
          >
            <SelectTrigger {...fieldA11y("plan-warehouse")} className={FORM_SELECT_CLASS}>
              <SelectValue placeholder={C.warehousePlaceholder} />
            </SelectTrigger>
            <TitledSelectContent title={C.warehouse}>
              {(warehouses.data ?? []).map((warehouse) => (
                <SelectItem key={warehouse.warehouseId} value={warehouse.warehouseId}>
                  {warehouse.name}
                </SelectItem>
              ))}
            </TitledSelectContent>
          </Select>
        </FormField>
        <CycleCountScopeFields
          values={values}
          zones={zones.data ?? []}
          error={error}
          onChange={edit}
        />
        <CycleCountPlanOptions values={values} assignees={assignees.data ?? []} onChange={edit} />
      </FormDialogBody>
    </FormDialog>
  );
}
