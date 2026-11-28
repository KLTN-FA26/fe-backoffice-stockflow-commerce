"use client";

import { useId } from "react";

import { FEE_BEARERS, FEE_BEARER_LABELS } from "@/constants";

import type { FeeBearer } from "@/constants";

const L = FEE_BEARER_LABELS;

/** Giá trị của ô: chưa chọn là "" — KHÔNG có mặc định (D50 DEF). */
export type FeeBearerChoice = FeeBearer | "";

/**
 * "Bên chịu phí" (D46 + D50): bắt buộc chọn khi có khoản phí, không chọn sẵn. Khách → như cũ; Công ty → khách không
 * bị tính phí, khoản này là chi phí công ty cho Kế toán. UI-only — Backend phải re-check (400 khi có phí mà thiếu bên
 * chịu, hoặc có bên chịu mà không có phí).
 */
export function FeeBearerField({
  value,
  onChange,
  error,
}: {
  value: FeeBearerChoice;
  onChange: (value: FeeBearer) => void;
  error?: string;
}) {
  const baseId = useId();
  const errorId = `${baseId}-error`;
  return (
    <fieldset
      className="space-y-1.5"
      aria-required="true"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="text-ink-secondary mb-1 text-xs font-medium">
        {L.legend} <span className="text-danger">*</span>
      </legend>
      <div className="flex gap-4">
        {FEE_BEARERS.map((bearer) => (
          <label key={bearer} className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={`${baseId}-bearer`}
              checked={value === bearer}
              onChange={() => onChange(bearer)}
              className="accent-brand"
            />
            <span className="text-ink-primary text-[0.8125rem]">{L.options[bearer]}</span>
          </label>
        ))}
      </div>
      {value !== "" && <p className="text-ink-secondary text-xs">{L.hints[value]}</p>}
      {error && (
        <p id={errorId} role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
    </fieldset>
  );
}
