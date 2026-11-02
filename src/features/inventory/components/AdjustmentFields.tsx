import { Controller } from "react-hook-form";

import {
  INVENTORY_LABELS,
  INVENTORY_LIMITS,
  STOCK_ADJUSTMENT_REASON_LABELS,
  STOCK_ADJUSTMENT_REASONS,
} from "@/constants/inventory";

import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { UseFormReturn } from "react-hook-form";
import type { CreateAdjustmentInput } from "../types";

export function AdjustmentFields({ form }: { form: UseFormReturn<CreateAdjustmentInput> }) {
  const {
    register,
    formState: { errors },
  } = form;
  return (
    <div className="grid grid-cols-1 gap-[var(--card-pad)] md:grid-cols-2">
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
          aria-describedby="delta-help delta-error"
        />
        <p id="delta-help" className="text-ink-secondary text-sm">
          {INVENTORY_LABELS.quantityDeltaHelp}
        </p>
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
        <Controller
          control={form.control}
          name="reason"
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onValueChange={async (value) => {
                field.onChange(value);
                await form.trigger(["reason", "note", "quantityDelta"]);
              }}
            >
              <SelectTrigger
                id="adjustment-reason"
                onBlur={field.onBlur}
                aria-invalid={Boolean(errors.reason)}
                aria-describedby="reason-error"
                className={FORM_SELECT_CLASS}
              >
                <SelectValue placeholder={INVENTORY_LABELS.chooseReason} />
              </SelectTrigger>
              <TitledSelectContent title={INVENTORY_LABELS.adjustmentReason}>
                {STOCK_ADJUSTMENT_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {STOCK_ADJUSTMENT_REASON_LABELS[reason]}
                  </SelectItem>
                ))}
              </TitledSelectContent>
            </Select>
          )}
        />
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
