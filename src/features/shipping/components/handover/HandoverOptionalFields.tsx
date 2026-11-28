"use client";

import { useState } from "react";

import { SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldError } from "../primitives";
import { HandoverTextField } from "./HandoverTextField";

import type { UseFormReturn } from "react-hook-form";
import type { HandoverFormInput, HandoverValues, Load } from "@/features/shipping/types";

const H = UI_LABELS.shipping.handover;

/**
 * Các ô không bắt buộc của biên bản (SĐT tài xế, mã biên bản giấy, ghi chú) gập sau một nút — hộp thoại không còn sáu ô
 * trống (S18-2). Mở sẵn khi SĐT đã về từ hãng, và tự mở khi BE báo lỗi ở một ô đang gập.
 */
export function HandoverOptionalFields({
  form,
  load,
}: {
  form: UseFormReturn<HandoverFormInput, unknown, HandoverValues>;
  load: Load;
}) {
  const errors = form.formState.errors;
  const [opened, setOpened] = useState(!!load.driverPhone);
  const open = opened || !!(errors.driverPhone || errors.signatureRef || errors.note);
  if (!open)
    return (
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto justify-start p-0 text-[0.8125rem]"
        onClick={() => setOpened(true)}
      >
        {H.moreOpen}
      </Button>
    );
  return (
    <>
      <HandoverTextField
        form={form}
        name="driverPhone"
        label={H.driverPhone}
        max={SHIPPING_LIMITS.driverPhoneMax}
        mono
      />
      <HandoverTextField
        form={form}
        name="signatureRef"
        label={H.signatureRef}
        max={SHIPPING_LIMITS.signatureRefMax}
      />
      <p className="text-ink-tertiary -mt-2 text-xs">{H.signatureRefHint}</p>
      <div>
        <Label
          htmlFor="handover-note"
          className="text-ink-secondary mb-1 block text-xs font-medium"
        >
          {H.note}
        </Label>
        <Textarea
          id="handover-note"
          rows={2}
          maxLength={SHIPPING_LIMITS.noteMax}
          aria-invalid={errors.note ? true : undefined}
          className="border-border-default bg-bg-surface rounded-[var(--r-sm)] text-[0.8125rem]"
          {...form.register("note")}
        />
        <FieldError>{errors.note?.message}</FieldError>
      </div>
    </>
  );
}
