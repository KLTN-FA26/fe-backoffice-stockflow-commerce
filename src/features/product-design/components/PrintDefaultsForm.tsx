"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { Controller } from "react-hook-form";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { cn } from "cn";
import { FORM_INPUT_CLASS, FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { FormSelect } from "@/components/shared/FormSelect";
import { TextField } from "@/components/shared/TextField";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { Control, UseFormRegister, FieldErrors } from "react-hook-form";
import type { ModelKind, PrintDefaultsValues } from "./print-defaults";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.advanced;
type Choice = "cupMaterial" | "bagMaterial" | "handle";
type FigureField = "safeMarginMm" | "bleedMm" | "seamMm" | "rimMm" | "topFoldMm";

const FIGURES: Record<ModelKind, readonly FigureField[]> = {
  "parametric-cup": ["safeMarginMm", "bleedMm", "seamMm", "rimMm"],
  "parametric-bag": ["safeMarginMm", "bleedMm", "topFoldMm"],
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
}: {
  name: Choice;
  control: Control<PrintDefaultsValues>;
  disabled: boolean;
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
    </div>
  );
}

/**
 * "Nâng cao": the defaults the file cannot tell (seam, rim, material, margins, top fold, handle). Prefilled, editable,
 * validated by zod through react-hook-form; the person confirms them with the manufacturer or the printer.
 */
export function PrintDefaultsForm({
  kind,
  register,
  control,
  errors,
  disabled,
}: {
  kind: ModelKind;
  register: UseFormRegister<PrintDefaultsValues>;
  control: Control<PrintDefaultsValues>;
  errors: FieldErrors<PrintDefaultsValues>;
  disabled: boolean;
}) {
  const [toggled, setOpen] = useState(false);
  // A refused value is shown on its input: the panel stays open while a field of the kind has an error.
  const open = toggled || FIGURES[kind].some((name) => errors[name] !== undefined);
  const panelId = useId();
  return (
    <section className="space-y-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <ChevronDown aria-hidden className={open ? "rotate-180" : undefined} />
        {TEXT.toggle}
      </Button>
      {open && (
        <div id={panelId} className="space-y-3">
          <p className="text-ink-secondary text-[0.8125rem]">{TEXT.note}</p>
          <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIGURES[kind].map((name) => (
              <TextField
                key={name}
                label={TEXT.fields[name]}
                type="number"
                inputMode="decimal"
                step="any"
                className={cn(FORM_INPUT_CLASS, "tabular-nums")}
                error={errors[name]?.message}
                {...register(name, { valueAsNumber: true })}
              />
            ))}
            {CHOICES[kind].map((name) => (
              <ChoiceField key={name} name={name} control={control} disabled={disabled} />
            ))}
          </fieldset>
        </div>
      )}
    </section>
  );
}
