"use client";

import { LOAD_PLAN_SOURCE_LABELS, LOAD_PLAN_SOURCE_TYPES, UI_LABELS } from "@/constants";

import type { LoadPlanSourceType } from "@/constants";

const L = UI_LABELS.loadPlan.transfer;

/**
 * Nguồn của kế hoạch (BE PR #164, LP-9): lô giao của đơn khách, hoặc MỘT lệnh chuyển kho đã đóng gói. Một kế hoạch chỉ đi
 * một loại — BE từ chối trộn (`LOAD_PLAN_SOURCE_MISMATCH`). Nhóm radio có nhãn như `ModePicker`.
 */
export function SourcePicker({
  name,
  value,
  onChange,
  disabled = false,
}: {
  name: string;
  value: LoadPlanSourceType;
  onChange: (source: LoadPlanSourceType) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="flex flex-wrap gap-2" disabled={disabled}>
      <legend className="sr-only">{L.sourceAria}</legend>
      {LOAD_PLAN_SOURCE_TYPES.map((source) => {
        const id = `${name}-${source}`;
        return (
          <label
            key={source}
            htmlFor={id}
            className="border-border-default bg-bg-surface hover:bg-bg-subtle has-[:checked]:border-brand flex cursor-pointer items-center gap-2 rounded border px-3 py-1.5 text-[0.8125rem]"
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={source}
              checked={value === source}
              onChange={() => onChange(source)}
              className="accent-brand"
            />
            <span className="text-ink-primary font-medium">{LOAD_PLAN_SOURCE_LABELS[source]}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
