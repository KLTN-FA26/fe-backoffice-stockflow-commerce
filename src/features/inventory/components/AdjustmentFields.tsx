import { Controller } from "react-hook-form";

import {
  INVENTORY_LABELS,
  INVENTORY_LIMITS,
  STOCK_ADJUSTMENT_DIRECTION_LABELS,
  STOCK_ADJUSTMENT_DIRECTIONS,
  STOCK_ADJUSTMENT_REASON_LABELS,
  STOCK_ADJUSTMENT_REQUEST_REASONS,
} from "@/constants/inventory";

import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { UseFormReturn } from "react-hook-form";
import type { CreateAdjustmentInput } from "../types";

function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p id={id} role={message ? "alert" : undefined} className="text-danger text-sm">
      {message}
    </p>
  );
}

/**
 * Đề nghị điều chỉnh MỘT thùng (docs 20 §4.3): LPN, chiều, lý do, ghi chú. Không có số lượng — thùng được
 * ghi giảm / nạp lại nguyên thùng (BR-14).
 */
export function AdjustmentFields({ form }: { form: UseFormReturn<CreateAdjustmentInput> }) {
  const {
    register,
    formState: { errors },
  } = form;
  return (
    <div className="grid grid-cols-1 gap-[var(--card-pad)] md:grid-cols-2">
      <div className="md:col-span-2">
        <Label htmlFor="adjustment-lpn">{INVENTORY_LABELS.lpn} *</Label>
        <Input
          className="bg-bg-surface rounded-[var(--r-sm)] font-[family-name:var(--font-mono)]"
          id="adjustment-lpn"
          {...register("lpn")}
          maxLength={INVENTORY_LIMITS.lpnLength}
          placeholder={INVENTORY_LABELS.lpnPlaceholder}
          autoComplete="off"
          spellCheck={false}
          autoFocus
          aria-invalid={Boolean(errors.lpn)}
          aria-describedby="lpn-help lpn-error"
        />
        <p id="lpn-help" className="text-ink-secondary text-sm">
          {INVENTORY_LABELS.lpnHelp}
        </p>
        <FieldError id="lpn-error" message={errors.lpn?.message} />
      </div>
      <div>
        <Label htmlFor="adjustment-direction">{INVENTORY_LABELS.direction} *</Label>
        <Controller
          control={form.control}
          name="direction"
          render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange}>
              <SelectTrigger
                id="adjustment-direction"
                onBlur={field.onBlur}
                aria-invalid={Boolean(errors.direction)}
                aria-describedby="direction-error"
                className={FORM_SELECT_CLASS}
              >
                <SelectValue placeholder={INVENTORY_LABELS.chooseDirection} />
              </SelectTrigger>
              <TitledSelectContent title={INVENTORY_LABELS.direction}>
                {STOCK_ADJUSTMENT_DIRECTIONS.map((direction) => (
                  <SelectItem key={direction} value={direction}>
                    {STOCK_ADJUSTMENT_DIRECTION_LABELS[direction]}
                  </SelectItem>
                ))}
              </TitledSelectContent>
            </Select>
          )}
        />
        <FieldError id="direction-error" message={errors.direction?.message} />
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
                await form.trigger(["reason", "note"]);
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
                {STOCK_ADJUSTMENT_REQUEST_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {STOCK_ADJUSTMENT_REASON_LABELS[reason]}
                  </SelectItem>
                ))}
              </TitledSelectContent>
            </Select>
          )}
        />
        <FieldError id="reason-error" message={errors.reason?.message} />
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
        <FieldError id="note-error" message={errors.note?.message} />
      </div>
    </div>
  );
}
