"use client";

import { SlidersHorizontal } from "lucide-react";
import { useId } from "react";
import { Controller, useWatch } from "react-hook-form";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { cn } from "cn";
import { DetailSection } from "@/components/shared/DetailSection";
import { FORM_INPUT_CLASS, FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { FormSelect } from "@/components/shared/FormSelect";
import { TextField } from "@/components/shared/TextField";
import { Label } from "@/components/ui/label";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { savedHint } from "./saved-values";

import type { ReactNode } from "react";
import type { Control, UseFormRegister, FieldErrors } from "react-hook-form";
import type { ModelKind, PrintDefaultsValues } from "./print-defaults";
import type { ChoiceField as Choice, FigureField } from "./saved-values";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.advanced;

const FIGURES: Record<ModelKind, readonly FigureField[]> = {
  "parametric-cup": ["safeMarginMm", "bleedMm", "seamMm", "rimMm"],
  "parametric-bag": ["safeMarginMm", "bleedMm", "topFoldMm", "glueFlapMm", "bottomFoldMm"],
};
const CHOICES: Record<ModelKind, readonly Choice[]> = {
  "parametric-cup": ["cupMaterial"],
  "parametric-bag": ["bagMaterial", "handle"],
};
const OPTIONS: Record<Choice, Readonly<Record<string, string>>> = {
  cupMaterial: TEXT.cupMaterials,
  bagMaterial: TEXT.bagMaterials,
  handle: TEXT.handles,
};

function ChoiceField({
  name,
  control,
  disabled,
  hint,
}: {
  name: Choice;
  control: Control<PrintDefaultsValues>;
  disabled: boolean;
  /** "Đang lưu: …" when the choice differs from the stored one. */
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-ink-secondary text-xs font-medium">
        {TEXT.fields[name]}
      </Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <FormSelect value={field.value} onValueChange={field.onChange} disabled={disabled}>
            <SelectTrigger id={id} onBlur={field.onBlur} className={FORM_SELECT_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(OPTIONS[name]).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </FormSelect>
        )}
      />
      {hint && <p className="text-ink-tertiary text-xs">{hint}</p>}
    </div>
  );
}

/**
 * "Số mặc định": the defaults the file cannot tell (seam, rim, material, margins, top fold, glue flap, bottom fold,
 * handle). Prefilled, editable, validated by zod through react-hook-form; the person confirms them with the
 * manufacturer or the printer. A card of the page like the others, closed until opened, and kept open while a field
 * of the kind has an error so the refused value is seen on its input. `preview` (a bag's flat sheet) is shown under
 * the fields. With `saved` (the stored configuration's values, same kind), a changed field says what is stored under
 * it, so the edit needs no second card to compare with.
 */
export function PrintDefaultsForm({
  kind,
  register,
  control,
  errors,
  disabled,
  preview,
  saved = null,
}: {
  kind: ModelKind;
  register: UseFormRegister<PrintDefaultsValues>;
  control: Control<PrintDefaultsValues>;
  errors: FieldErrors<PrintDefaultsValues>;
  disabled: boolean;
  preview?: ReactNode;
  saved?: PrintDefaultsValues | null;
}) {
  const current = useWatch({ control });
  // A refused value is shown on its input: the card stays open while a field of the kind has an error.
  const hasError = FIGURES[kind].some((name) => errors[name] !== undefined);
  return (
    <DetailSection
      title={TEXT.title}
      icon={SlidersHorizontal}
      defaultOpen={false}
      forceOpen={hasError}
    >
      {/* Sized by its column (the narrow work column on a wide screen), not by the screen. */}
      <div className="@container space-y-3">
        <p className="text-ink-secondary max-w-[68ch] text-[0.8125rem]">{TEXT.note}</p>
        <fieldset disabled={disabled} className="grid gap-3 @sm:grid-cols-2 @3xl:grid-cols-3">
          {FIGURES[kind].map((name) => (
            <TextField
              key={name}
              label={TEXT.fields[name]}
              type="number"
              inputMode="decimal"
              step="any"
              className={cn(FORM_INPUT_CLASS, "tabular-nums")}
              error={errors[name]?.message}
              hint={savedHint(name, current, saved)}
              {...register(name, { valueAsNumber: true })}
            />
          ))}
          {CHOICES[kind].map((name) => (
            <ChoiceField
              key={name}
              name={name}
              control={control}
              disabled={disabled}
              hint={savedHint(name, current, saved)}
            />
          ))}
        </fieldset>
        {preview}
      </div>
    </DetailSection>
  );
}
