import {
  INVENTORY_LABELS,
  INVENTORY_LIMITS,
  STOCK_ADJUSTMENT_REASONS,
} from "@/constants/inventory";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { UseFormReturn } from "react-hook-form";
import type { CreateAdjustmentInput } from "../types";

export function AdjustmentFields({ form }: { form: UseFormReturn<CreateAdjustmentInput> }) {
  const {
    register,
    formState: { errors },
  } = form;
  const reasonField = register("reason");
  return (
    <div className="grid gap-[var(--card-pad)] md:grid-cols-2">
      {(
        [
          ["locationCode", INVENTORY_LABELS.location, INVENTORY_LIMITS.locationLength],
          ["sku", INVENTORY_LABELS.sku, INVENTORY_LIMITS.skuMaxLength],
          ["lotNumber", INVENTORY_LABELS.lot, INVENTORY_LIMITS.lotLength],
        ] as const
      ).map(([field, label, limit]) => (
        <div key={field}>
          <Label htmlFor={`adjustment-${field}`}>
            {label}
            {field !== "lotNumber" && " *"}
          </Label>
          <Input
            className="bg-bg-surface rounded-[var(--r-sm)]"
            id={`adjustment-${field}`}
            {...register(field)}
            maxLength={limit}
            autoFocus={field === "locationCode"}
            aria-invalid={Boolean(errors[field])}
            aria-describedby={errors[field] ? `${field}-error` : undefined}
          />
          {errors[field] && (
            <p id={`${field}-error`} role="alert" className="text-danger text-sm">
              {errors[field]?.message}
            </p>
          )}
        </div>
      ))}
      <div>
        <Label htmlFor="adjustment-delta">{INVENTORY_LABELS.quantityDelta} *</Label>
        <Input
          className="bg-bg-surface rounded-[var(--r-sm)]"
          id="adjustment-delta"
          type="number"
          step={1}
          min={-INVENTORY_LIMITS.delta}
          max={INVENTORY_LIMITS.delta}
          {...register("quantityDelta", { valueAsNumber: true })}
          aria-invalid={Boolean(errors.quantityDelta)}
          aria-describedby="delta-error"
        />
        <p
          id="delta-error"
          role={errors.quantityDelta ? "alert" : undefined}
          className="text-danger text-sm"
        >
          {errors.quantityDelta?.message}
        </p>
      </div>
      <div>
        <Label htmlFor="adjustment-reason">{INVENTORY_LABELS.adjustmentReason} *</Label>
        <select
          id="adjustment-reason"
          {...reasonField}
          onChange={async (event) => {
            await reasonField.onChange(event);
            await form.trigger(["reason", "note", "quantityDelta"]);
          }}
          defaultValue=""
          aria-invalid={Boolean(errors.reason)}
          aria-describedby="reason-error"
          className="border-border-default bg-bg-surface focus-visible:ring-brand h-9 w-full rounded-[var(--r-sm)] border px-[var(--el-gap)] focus-visible:ring-2"
        >
          <option value="">{INVENTORY_LABELS.chooseReason}</option>
          {STOCK_ADJUSTMENT_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </select>
        <p
          id="reason-error"
          role={errors.reason ? "alert" : undefined}
          className="text-danger text-sm"
        >
          {errors.reason?.message}
        </p>
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="adjustment-note">{INVENTORY_LABELS.note}</Label>
        <Textarea
          className="bg-bg-surface rounded-[var(--r-sm)]"
          id="adjustment-note"
          {...register("note")}
          maxLength={INVENTORY_LIMITS.noteLength}
          aria-invalid={Boolean(errors.note)}
          aria-describedby="note-error"
        />
        <p id="note-error" role={errors.note ? "alert" : undefined} className="text-danger text-sm">
          {errors.note?.message}
        </p>
      </div>
    </div>
  );
}
