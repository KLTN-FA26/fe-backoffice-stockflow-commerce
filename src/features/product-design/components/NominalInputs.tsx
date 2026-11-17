"use client";

import { MODEL3D_NOMINAL_LABELS } from "@/constants/labels-model3d";
import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { cn } from "cn";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { TextField } from "@/components/shared/TextField";

import { NOMINAL_KEYS } from "./nominal";

import type { NominalKey, NominalText } from "./nominal";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.nominal;

/**
 * The optional cross-check: the manufacturer's figures, typed in, are compared with those read from the file. Blank
 * fields are ignored; a figure more than 1 mm off gives a warning and never blocks the save.
 */
export function NominalInputs({
  kind,
  values,
  invalid,
  disabled,
  onChange,
}: {
  kind: "cup" | "bag";
  values: NominalText;
  invalid: ReadonlySet<NominalKey>;
  disabled: boolean;
  onChange: (key: NominalKey, text: string) => void;
}) {
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-ink-primary text-sm font-semibold">{TEXT.legend}</legend>
      <p className="text-ink-secondary text-[0.8125rem]">{TEXT.hint}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {NOMINAL_KEYS[kind].map((key) => (
          <TextField
            key={key}
            label={TEXT.unit(MODEL3D_NOMINAL_LABELS[key])}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className={cn(FORM_INPUT_CLASS, "tabular-nums")}
            value={values[key] ?? ""}
            error={invalid.has(key) ? TEXT.invalid : undefined}
            onChange={(event) => onChange(key, event.target.value)}
          />
        ))}
      </div>
    </fieldset>
  );
}
