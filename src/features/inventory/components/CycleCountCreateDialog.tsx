"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  CYCLE_COUNT_CREATE_LABELS,
  CYCLE_COUNT_LABELS,
  CYCLE_COUNT_ROUTES,
} from "@/constants/cycle-count";
import { CYCLE_COUNT_PERMISSIONS } from "@/constants/permissions";

import { useCan } from "@/lib/auth";
import { useWarehouseZones } from "@/lib/references/warehouse-layout";
import { useWarehouseOptions } from "@/lib/references/warehouse-options";
import { useAppStore } from "@/lib/store/use-app-store";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_SELECT_CLASS, FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { toast } from "@/components/shared/Toast";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { planCycleCountError } from "../cycle-count-errors";
import { usePlanCycleCount } from "../cycle-count-mutations";
import { useCycleCountAssignees } from "../cycle-count-queries";
import { planCycleCountInput, splitCodes } from "../cycle-count-schemas";

const C = CYCLE_COUNT_CREATE_LABELS;
const NONE = "none";

/**
 * Lập phiếu kiểm kê tay (BE `POST /inventory/cycle-counts`, docs 20 §4.2 a, BR-12): kho, phạm vi (khu, kệ, vị trí,
 * SKU — ít nhất một, tối đa 500 thùng do BE kiểm), kiểm mù (mặc định có) và người đếm (có thể giao sau). Lập xong mở
 * phiếu mới; thùng bị bỏ qua vì đang nằm trên phiếu khác thì báo số lượng.
 */
export function CycleCountCreateDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const canCreate = useCan(CYCLE_COUNT_PERMISSIONS.create);
  const plan = usePlanCycleCount();
  const current = useAppStore((state) => state.warehouseId);
  const warehouses = useWarehouseOptions();
  const [warehouseId, setWarehouseId] = useState(current ?? "");
  const [zoneIds, setZoneIds] = useState<string[]>([]);
  const [shelves, setShelves] = useState("");
  const [locations, setLocations] = useState("");
  const [skus, setSkus] = useState("");
  const [blind, setBlind] = useState(true);
  const [assignedUserId, setAssignedUserId] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const zones = useWarehouseZones(warehouseId);
  const assignees = useCycleCountAssignees(warehouseId, canCreate);

  const edit = (apply: () => void) => {
    apply();
    setError(undefined);
    setServerError(null);
  };

  const submit = () => {
    const parsed = planCycleCountInput.safeParse({
      warehouseId,
      blind,
      assignedUserId: assignedUserId || undefined,
      zoneIds,
      shelfCodes: splitCodes(shelves),
      locationCodes: splitCodes(locations),
      skus: splitCodes(skus),
    });
    if (!parsed.success) {
      setError(warehouseId ? parsed.error.issues[0]?.message : C.warehouseRequired);
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
        canSubmit={canCreate && Boolean(warehouseId)}
        isPending={plan.isPending}
        error={serverError}
        onSubmit={submit}
        onCancel={onClose}
      >
        <FormField id="plan-warehouse" label={C.warehouse} required>
          <Select
            value={warehouseId}
            onValueChange={(value) =>
              edit(() => {
                setWarehouseId(value);
                setZoneIds([]);
                setAssignedUserId("");
              })
            }
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
        <fieldset className="min-w-0 space-y-3 border-0 p-0">
          <legend className="text-ink-secondary text-xs font-medium">{C.scope}</legend>
          {(zones.data?.length ?? 0) > 0 && (
            <div role="group" aria-label={C.zones} className="flex flex-wrap gap-x-4 gap-y-1.5">
              {zones.data?.map((zone) => (
                <label
                  key={zone.id}
                  className="text-ink-secondary flex items-center gap-2 text-[0.8125rem]"
                >
                  <Checkbox
                    checked={zoneIds.includes(zone.id)}
                    onCheckedChange={(checked) =>
                      edit(() =>
                        setZoneIds((ids) =>
                          checked === true ? [...ids, zone.id] : ids.filter((id) => id !== zone.id),
                        ),
                      )
                    }
                  />
                  {zone.name}
                </label>
              ))}
            </div>
          )}
          <FormField id="plan-shelves" label={C.shelves} hint={C.shelvesHint}>
            <Textarea
              {...fieldA11y("plan-shelves", undefined, true)}
              rows={2}
              value={shelves}
              className={FORM_TEXTAREA_CLASS}
              onChange={(event) => edit(() => setShelves(event.target.value))}
            />
          </FormField>
          <FormField id="plan-locations" label={C.locations} hint={C.locationsHint}>
            <Textarea
              {...fieldA11y("plan-locations", undefined, true)}
              rows={2}
              value={locations}
              className={FORM_TEXTAREA_CLASS}
              onChange={(event) => edit(() => setLocations(event.target.value))}
            />
          </FormField>
          <FormField id="plan-skus" label={C.skus} hint={C.skusHint} error={error}>
            <Textarea
              {...fieldA11y("plan-skus", error, true)}
              rows={2}
              value={skus}
              className={FORM_TEXTAREA_CLASS}
              onChange={(event) => edit(() => setSkus(event.target.value))}
            />
          </FormField>
        </fieldset>
        <label className="text-ink-secondary flex items-start gap-2 text-[0.8125rem]">
          <Checkbox
            className="mt-0.5"
            checked={blind}
            onCheckedChange={(checked) => setBlind(checked === true)}
          />
          <span>
            <span className="text-ink-primary block font-medium">{CYCLE_COUNT_LABELS.blind}</span>
            <span className="text-ink-tertiary block text-xs">{C.blindHint}</span>
          </span>
        </label>
        <FormField id="plan-counter" label={C.counter} hint={C.counterHint}>
          <Select
            value={assignedUserId || NONE}
            onValueChange={(value) => edit(() => setAssignedUserId(value === NONE ? "" : value))}
          >
            <SelectTrigger
              {...fieldA11y("plan-counter", undefined, true)}
              className={FORM_SELECT_CLASS}
            >
              <SelectValue placeholder={C.counterPlaceholder} />
            </SelectTrigger>
            <TitledSelectContent title={C.counter}>
              <SelectItem value={NONE}>{C.counterPlaceholder}</SelectItem>
              {(assignees.data ?? []).map((user) => (
                <SelectItem key={user.userId} value={user.userId}>
                  {user.displayName}
                </SelectItem>
              ))}
            </TitledSelectContent>
          </Select>
        </FormField>
      </FormDialogBody>
    </FormDialog>
  );
}
