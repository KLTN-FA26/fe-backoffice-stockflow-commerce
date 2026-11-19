"use client";

import { PRODUCTION_LABELS, REPRINT_REASON_LABELS, REPRINT_REASONS } from "@/constants";

import type { ReprintReason } from "@/constants";

const S = PRODUCTION_LABELS.sample;

/** Lý do in lại (BR-24): lỗi in không tính vào số lần in mẫu miễn phí, khách đổi ý thì tính. */
export function ReprintReasonField({
  value,
  onChange,
}: {
  value: ReprintReason | null;
  onChange: (reason: ReprintReason) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-ink-secondary mb-1 text-xs font-medium">{S.reprintReason} *</legend>
      {REPRINT_REASONS.map((reason) => (
        <label key={reason} className="flex items-center gap-2 text-[0.8125rem]">
          <input
            type="radio"
            name="reprint-reason"
            value={reason}
            checked={value === reason}
            onChange={() => onChange(reason)}
            className="accent-brand size-3.5"
          />
          {REPRINT_REASON_LABELS[reason]} — {reason === "PRINT_DEFECT" ? S.notCounted : S.counted}
        </label>
      ))}
    </fieldset>
  );
}
