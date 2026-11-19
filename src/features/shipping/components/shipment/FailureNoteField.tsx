"use client";

import { SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldError } from "../primitives";

import type { UseFormRegisterReturn } from "react-hook-form";

const D = UI_LABELS.shipping.shipment.outcomeDialog;

/** Ghi chú nội bộ của lần giao thất bại — bắt buộc khi lý do là "Lý do khác" (docs 09 §4.3 bước 3). */
export function FailureNoteField({
  id,
  register,
  reasonIsOther,
  error,
}: {
  id: string;
  register: UseFormRegisterReturn;
  reasonIsOther: boolean;
  error?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-ink-secondary mb-1 block text-xs font-medium">
        {D.note} {reasonIsOther && <span className="text-danger">*</span>}
      </Label>
      <Textarea
        id={id}
        rows={2}
        maxLength={SHIPPING_LIMITS.noteMax}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint`}
        className="border-border-default bg-bg-surface rounded-[var(--r-sm)] text-[0.8125rem]"
        {...register}
      />
      <p id={`${id}-hint`} className="text-ink-tertiary mt-1 text-xs">
        {reasonIsOther ? D.noteRequired : D.noteOptional}
      </p>
      <FieldError>{error}</FieldError>
    </div>
  );
}
