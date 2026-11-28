"use client";

import {
  LOAD_PLAN_MODE_HINTS,
  LOAD_PLAN_MODE_LABELS,
  LOAD_PLAN_SELECTION_MODES,
  UI_LABELS,
} from "@/constants";

import type { LoadPlanSelectionMode } from "@/constants";

const L = UI_LABELS.loadPlan.createForm;

/**
 * Chế độ chọn xe — đủ sáu dòng của bảng docs 09 §4.2 (WF4-LP-MODES): năm chế độ chọn được (một loại là mặc định) và
 * "Chỉnh tay", không chọn trước khi tính mà làm ở trang kế hoạch (kéo thả rồi tính lại một xe), nên hiện như một dòng
 * chú thích dưới nhóm, không phải ô chọn. Nhóm radio có nhãn, mỗi lựa chọn kèm một câu giải thích.
 */
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
    <>
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
                <span className="text-ink-tertiary block text-xs">
                  {LOAD_PLAN_MODE_HINTS[mode]}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>
      {/* "Chỉnh tay" không chọn trước khi tính nên là dòng chú thích, không phải ô trông như bấm được (S16-3) */}
      <p className="text-ink-tertiary text-xs">{L.manualModeNote}</p>
    </>
  );
}
