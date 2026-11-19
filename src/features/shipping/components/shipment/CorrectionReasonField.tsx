"use client";

import { SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldError } from "../primitives";

import type { UseFormRegisterReturn } from "react-hook-form";

const C = UI_LABELS.shipping.shipment.correction;

/** Lý do sửa — bắt buộc, ≤ 500 ký tự; BE lưu cùng lần sửa (docs 09 §4.3 bước 5). */
export function CorrectionReasonField({
  register,
  error,
}: {
  register: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <div>
      <Label
        htmlFor="correction-reason"
        className="text-ink-secondary mb-1 block text-xs font-medium"
      >
        {C.reason} <span className="text-danger">*</span>
      </Label>
      <Textarea
        id="correction-reason"
        rows={3}
        maxLength={SHIPPING_LIMITS.cancelReasonMax}
        placeholder={C.reasonPlaceholder}
        aria-invalid={error ? true : undefined}
        aria-describedby="correction-reason-hint"
        className="border-border-default bg-bg-surface rounded-[var(--r-sm)] text-[0.8125rem]"
        {...register}
      />
      <p id="correction-reason-hint" className="text-ink-tertiary mt-1 text-xs">
        {C.reasonHint}
      </p>
      <FieldError>{error}</FieldError>
    </div>
  );
}
