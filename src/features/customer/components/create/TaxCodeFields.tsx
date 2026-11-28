"use client";

import { Controller, useWatch } from "react-hook-form";

import { CUSTOMER_CREATE_OWNER_LABELS as L } from "@/constants";
import { TAX_CODE_EXEMPTION_REASON_MAX } from "@/features/customer/schemas";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { UseFormReturn } from "react-hook-form";
import type { CustomerCreateFormValues } from "@/features/customer/types";

/**
 * Mã số thuế của khách mới — bắt buộc (BR-S14, D4). Sales Manager (`canExempt`) được miễn cho hộ kinh doanh / ngoại lệ, kèm
 * lý do; Sale thường không thấy ô miễn. UI-only — Backend phải re-check (400 CUSTOMER_TAX_CODE_REQUIRED).
 */
export function TaxCodeFields({
  form,
  canExempt,
}: {
  form: UseFormReturn<CustomerCreateFormValues>;
  canExempt: boolean;
}) {
  const { register, control, formState, clearErrors } = form;
  const { errors } = formState;
  const exempt = useWatch({ control, name: "taxCodeExemption" }) === true && canExempt;
  return (
    <>
      <FormField
        id="customer-taxCode"
        label="Mã số thuế"
        required={!exempt}
        error={errors.taxCode?.message}
        hint={L.taxCodeHint}
      >
        <Input
          {...register("taxCode")}
          {...fieldA11y("customer-taxCode", errors.taxCode?.message, true)}
          inputMode="numeric"
          className={`${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)] tabular-nums`}
        />
      </FormField>
      {canExempt && (
        <div className="flex flex-col gap-2 sm:col-span-2">
          {/* `CheckboxField` cần ô kiểu boolean; ô này có mặc định (input `boolean | undefined`) nên dùng Controller. */}
          <Controller
            control={control}
            name="taxCodeExemption"
            render={({ field }) => (
              <label className="text-ink-secondary flex items-center gap-2 text-[0.8125rem]">
                <Checkbox
                  ref={field.ref}
                  checked={field.value === true}
                  onBlur={field.onBlur}
                  onCheckedChange={(value) => {
                    const checked = value === true;
                    field.onChange(checked);
                    clearErrors(checked ? "taxCode" : "exemptionReason");
                  }}
                />
                {L.exemption}
              </label>
            )}
          />
          {exempt && (
            <FormField
              id="customer-exemptionReason"
              label={L.exemptionReason}
              required
              error={errors.exemptionReason?.message}
              hint={L.exemptionHint}
            >
              <Textarea
                {...register("exemptionReason")}
                {...fieldA11y("customer-exemptionReason", errors.exemptionReason?.message, true)}
                rows={2}
                maxLength={TAX_CODE_EXEMPTION_REASON_MAX}
              />
            </FormField>
          )}
        </div>
      )}
    </>
  );
}
