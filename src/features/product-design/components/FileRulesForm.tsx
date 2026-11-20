"use client";

import { FileCheck2 } from "lucide-react";
import { useId } from "react";
import { Controller, useWatch } from "react-hook-form";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { PRINT_CONFIG_LIMITS } from "@/constants/numbers";
import { STUDIO_FONTS } from "@/constants/studio-fonts";
import { cn } from "cn";
import { DetailSection } from "@/components/shared/DetailSection";
import { FORM_INPUT_CLASS, FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { FormSelect } from "@/components/shared/FormSelect";
import { TextField } from "@/components/shared/TextField";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import type { PrintDefaultsValues } from "./print-defaults";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.fileRules;
const OPTION_CLASS = "text-ink-secondary flex min-h-8 items-center gap-2 text-[0.8125rem]";
const FIELDS = [
  "minDpi",
  "colorMode",
  "allowedFileFormats",
  "maxFileSizeMb",
  "maxColors",
  "allowedFontCodes",
] as const;

/** A group of boxes, one per choice, bound to a list of the form (`null` kept for "every"). */
function Choices({
  name,
  legend,
  control,
  choices,
  disabled,
  error,
}: {
  name: "allowedFileFormats" | "allowedFontCodes";
  legend: string;
  control: Control<PrintDefaultsValues>;
  choices: readonly { value: string; label: string }[];
  disabled: boolean;
  error?: string;
}) {
  const ids = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const ticked: readonly string[] = field.value ?? [];
        const toggle = (value: string, on: boolean) =>
          field.onChange(
            choices.map((c) => c.value).filter((v) => (v === value ? on : ticked.includes(v))),
          );
        return (
          <fieldset disabled={disabled} className="flex flex-col gap-1.5">
            <legend className="text-ink-secondary mb-1.5 text-xs font-medium">{legend}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {choices.map(({ value, label }) => (
                <label key={value} htmlFor={`${ids}-${value}`} className={OPTION_CLASS}>
                  <Checkbox
                    id={`${ids}-${value}`}
                    checked={ticked.includes(value)}
                    onBlur={field.onBlur}
                    onCheckedChange={(on) => toggle(value, on === true)}
                  />
                  {label}
                </label>
              ))}
            </div>
            {error && <p className="text-danger text-xs">{error}</p>}
          </fieldset>
        );
      }}
    />
  );
}

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

/** "Font được dùng": every font (`null`), or only the ticked ones. */
function Fonts({
  control,
  disabled,
  error,
}: {
  control: Control<PrintDefaultsValues>;
  disabled: boolean;
  error?: string;
}) {
  const fonts = useWatch({ control, name: "allowedFontCodes" });
  const limited = fonts !== null;
  const name = useId();
  return (
    <div className="flex flex-col gap-2 @sm:col-span-2 @3xl:col-span-3">
      <Controller
        control={control}
        name="allowedFontCodes"
        render={({ field }) => (
          <fieldset disabled={disabled} className="flex flex-col gap-1">
            <legend className="text-ink-secondary mb-1.5 text-xs font-medium">
              {TEXT.fields.allowedFontCodes}
            </legend>
            {[false, true].map((only) => (
              <label key={String(only)} className={OPTION_CLASS}>
                <input
                  type="radio"
                  name={name}
                  className="accent-accent size-4"
                  checked={limited === only}
                  onChange={() => field.onChange(only ? [STUDIO_FONTS[0].code] : null)}
                />
                {only ? TEXT.fontsOnly : TEXT.fontsAll}
              </label>
            ))}
          </fieldset>
        )}
      />
      {limited && (
        <Choices
          name="allowedFontCodes"
          legend={TEXT.fontsGroup}
          control={control}
          choices={STUDIO_FONTS.map(({ code, label }) => ({ value: code, label }))}
          disabled={disabled}
          error={error}
        />
      )}
    </div>
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
