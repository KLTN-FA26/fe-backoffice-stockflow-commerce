"use client";

import {
  LOAD_PLAN_MODE_HINTS,
  LOAD_PLAN_MODE_LABELS,
  LOAD_PLAN_SELECTION_MODES,
  UI_LABELS,
} from "@/constants";

import type { LoadPlanSelectionMode } from "@/constants";

const L = UI_LABELS.loadPlan.createForm;

/** Chế độ chọn xe (LP-6): một loại (mặc định) hoặc ít xe nhất. Nhóm radio có nhãn, mỗi lựa chọn kèm một câu giải thích. */
export function ModePicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: LoadPlanSelectionMode;
  onChange: (mode: LoadPlanSelectionMode) => void;
}) {
  return (
    <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <legend className="sr-only">{L.modeTitle}</legend>
      {LOAD_PLAN_SELECTION_MODES.map((mode) => {
        const id = `${name}-${mode}`;
        return (
          <label
            key={mode}
            htmlFor={id}
            className="border-border-default bg-bg-surface hover:bg-bg-subtle has-[:checked]:border-brand flex cursor-pointer items-start gap-2 rounded-[var(--r-sm)] border p-2.5 text-[0.8125rem]"
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={mode}
              checked={value === mode}
              onChange={() => onChange(mode)}
              className="accent-brand mt-0.5"
            />
            <span>
              <span className="text-ink-primary block font-medium">
                {LOAD_PLAN_MODE_LABELS[mode]}
              </span>
              <span className="text-ink-tertiary block text-xs">{LOAD_PLAN_MODE_HINTS[mode]}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
