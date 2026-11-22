"use client";

import { useId } from "react";
import { Controller } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";

import type { Control } from "react-hook-form";
import type { PrintDefaultsValues } from "./print-defaults";

export const OPTION_CLASS = "text-ink-secondary flex min-h-8 items-center gap-2 text-[0.8125rem]";

/** A group of boxes, one per choice, bound to a list of the form (`null` kept for "every"). */
export function Choices({
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
