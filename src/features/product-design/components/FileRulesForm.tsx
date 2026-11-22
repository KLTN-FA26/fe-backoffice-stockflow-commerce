"use client";

import { FileCheck2 } from "lucide-react";
import { useId } from "react";
import { Controller } from "react-hook-form";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { PRINT_CONFIG_LIMITS } from "@/constants/numbers";
import { cn } from "cn";
import { DetailSection } from "@/components/shared/DetailSection";
import { FORM_INPUT_CLASS, FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { FormSelect } from "@/components/shared/FormSelect";
import { TextField } from "@/components/shared/TextField";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Choices, OPTION_CLASS } from "./FileRulesChoices";
import { Fonts } from "./FontsField";

import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import type { PrintDefaultsValues } from "./print-defaults";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.fileRules;
const FIELDS = [
  "minDpi",
  "colorMode",
  "allowedFileFormats",
  "maxFileSizeMb",
  "maxColors",
  "allowedFontCodes",
] as const;

/** "Số màu mực tối đa": a number, or "Không giới hạn" (null, the BE's "no limit"). */
function MaxColors({
  control,
  disabled,
  error,
}: {
  control: Control<PrintDefaultsValues>;
  disabled: boolean;
  error?: string;
}) {
  return (
    <Controller
      control={control}
      name="maxColors"
      render={({ field }) => (
        <div className="flex flex-col gap-1.5">
          <TextField
            label={TEXT.fields.maxColors}
            type="number"
            inputMode="numeric"
            step={1}
            className={cn(FORM_INPUT_CLASS, "tabular-nums")}
            disabled={disabled || field.value === null}
            error={error}
            value={field.value === null || Number.isNaN(field.value) ? "" : field.value}
            onBlur={field.onBlur}
            onChange={(event) => field.onChange(event.target.valueAsNumber)}
          />
          <label className={OPTION_CLASS}>
            <Checkbox
              checked={field.value === null}
              disabled={disabled}
              onCheckedChange={(on) =>
                field.onChange(on === true ? null : PRINT_CONFIG_LIMITS.maxColorsStart)
              }
            />
            {TEXT.noColorLimit}
          </label>
        </div>
      )}
    />
  );
}

/**
 * "Ràng buộc file": what the customer's uploads are held to. Editable beside the defaults, in the same form (so
 * "dirty", the save and the server's field errors follow); closed until opened and kept open while one of its fields
 * has an error. The BE reads a missing list of fonts as "every font" and a missing colour count as "no limit".
 */
export function FileRulesForm({
  register,
  control,
  errors,
  disabled,
}: {
  register: UseFormRegister<PrintDefaultsValues>;
  control: Control<PrintDefaultsValues>;
  errors: FieldErrors<PrintDefaultsValues>;
  disabled: boolean;
}) {
  const colorModeId = useId();
  const hasError = FIELDS.some((name) => errors[name] !== undefined);
  const message = (name: (typeof FIELDS)[number]) => {
    const error = errors[name];
    // A list's error sits on the list, or on one of its entries.
    return error?.message ?? (Array.isArray(error) ? error.find(Boolean)?.message : undefined);
  };
  return (
    <DetailSection title={TEXT.title} icon={FileCheck2} defaultOpen={false} forceOpen={hasError}>
      <div className="@container space-y-3">
        <p className="text-ink-secondary max-w-[68ch] text-[0.8125rem]">{TEXT.note}</p>
        <fieldset disabled={disabled} className="grid gap-3 @sm:grid-cols-2 @3xl:grid-cols-3">
          <TextField
            label={TEXT.fields.minDpi}
            type="number"
            inputMode="numeric"
            step={1}
            className={cn(FORM_INPUT_CLASS, "tabular-nums")}
            error={message("minDpi")}
            {...register("minDpi", { valueAsNumber: true })}
          />
          <TextField
            label={TEXT.fields.maxFileSizeMb}
            type="number"
            inputMode="numeric"
            step={1}
            className={cn(FORM_INPUT_CLASS, "tabular-nums")}
            error={message("maxFileSizeMb")}
            {...register("maxFileSizeMb", { valueAsNumber: true })}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={colorModeId} className="text-ink-secondary text-xs font-medium">
              {TEXT.fields.colorMode}
            </Label>
            <Controller
              control={control}
              name="colorMode"
              render={({ field }) => (
                <FormSelect value={field.value} onValueChange={field.onChange} disabled={disabled}>
                  <SelectTrigger
                    id={colorModeId}
                    onBlur={field.onBlur}
                    className={FORM_SELECT_CLASS}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRINT_CONFIG_LIMITS.colorModes.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {TEXT.colorModes[mode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </FormSelect>
              )}
            />
          </div>
          <MaxColors control={control} disabled={disabled} error={message("maxColors")} />
          <div className="@sm:col-span-2 @3xl:col-span-3">
            <Choices
              name="allowedFileFormats"
              legend={TEXT.fields.allowedFileFormats}
              control={control}
              choices={PRINT_CONFIG_LIMITS.allowedFileFormats.map((value) => ({
                value,
                label: TEXT.formats[value],
              }))}
              disabled={disabled}
              error={message("allowedFileFormats")}
            />
          </div>
          <Fonts control={control} disabled={disabled} error={message("allowedFontCodes")} />
        </fieldset>
      </div>
    </DetailSection>
  );
}
