"use client";

import { Controller } from "react-hook-form";

import { RETURN_LABELS, RETURN_REASON_LABELS } from "@/constants/labels-return";
import { RETURN_LIMITS, RETURN_OPENABLE_REASONS } from "@/constants/returns";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FormSelect } from "@/components/shared/FormSelect";
import { FORM_SELECT_CLASS, FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { OpenFormValues } from "../types";

const L = RETURN_LABELS.openDialog;

/** Lý do, bảng số lượng (children), mô tả và lý do nhận ngoài hạn của form mở yêu cầu trả hàng. */
export function OpenReturnFields({
  form,
  late,
  windowDays,
  children,
}: {
  form: UseFormReturn<OpenFormValues>;
  late: boolean;
  windowDays: number;
  children: ReactNode;
}) {
  const { errors } = form.formState;
  return (
    <>
      <FormField id="open-reason" label={L.reason} required error={errors.reasonCode?.message}>
        <Controller
          control={form.control}
          name="reasonCode"
          render={({ field }) => (
            <FormSelect value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="open-reason" className={FORM_SELECT_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETURN_OPENABLE_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {RETURN_REASON_LABELS[reason]}
                  </SelectItem>
                ))}
              </SelectContent>
            </FormSelect>
          )}
        />
      </FormField>
      {children}
      <FormField
        id="open-description"
        label={L.descriptionField}
        error={errors.description?.message}
      >
        <Textarea
          rows={3}
          maxLength={RETURN_LIMITS.descriptionMax}
          className={FORM_TEXTAREA_CLASS}
          {...fieldA11y("open-description", errors.description?.message)}
          {...form.register("description")}
        />
      </FormField>
      <FormField
        id="open-late"
        label={L.lateClaim(windowDays)}
        required={late}
        error={errors.lateClaimReason?.message}
      >
        <Textarea
          rows={2}
          maxLength={RETURN_LIMITS.lateClaimReasonMax}
          className={FORM_TEXTAREA_CLASS}
          {...fieldA11y("open-late", errors.lateClaimReason?.message)}
          {...form.register("lateClaimReason")}
        />
      </FormField>
    </>
  );
}
