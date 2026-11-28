"use client";

import { Controller, useWatch } from "react-hook-form";

import { DELIVERY_FAILURE_LABELS, DELIVERY_FAILURE_LIMITS } from "@/constants";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FeeBearerField } from "../FeeBearerField";
import { FormFieldError, RequiredMark } from "../FormFieldError";

import type { UseFormReturn } from "react-hook-form";
import type {
  CancelUndeliveredFormValues,
  CancelUndeliveredValues,
} from "../../delivery-failure-schemas";

const L = DELIVERY_FAILURE_LABELS.cancel;

/**
 * Phí thoả thuận cho hàng đã làm khi huỷ phần chưa giao (BE `CancellationFeeRequest {amount, reason, detail}`): hàng in
 * theo thiết kế của khách mặc định không hoàn tiền. Tắt = không gửi `agreedFee`.
 */
export function AgreedFeeInputs({
  form,
  enabled,
}: {
  form: UseFormReturn<CancelUndeliveredFormValues, unknown, CancelUndeliveredValues>;
  enabled: boolean;
}) {
  const errors = form.formState.errors;
  const bearer = useWatch({ control: form.control, name: "feeBearer" });
  return (
    <fieldset className="border-border-default space-y-3 rounded-[var(--r-sm)] border p-3">
      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" className="accent-brand" {...form.register("withFee")} />
        <span className="text-ink-primary text-[0.8125rem] font-medium">{L.feeToggle}</span>
      </label>
      <p className="text-ink-secondary text-xs">{L.feeHint}</p>
      {enabled && (
        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="cancel-fee-amount" className="text-xs">
              {L.feeAmount} <RequiredMark />
            </Label>
            <Controller
              control={form.control}
              name="feeAmount"
              render={({ field }) => (
                // Tiền: chấm nghìn khi gõ, hậu tố ₫; giá trị ra vẫn là chuỗi chữ số (UX audit S01-7)
                <MoneyInput
                  id="cancel-fee-amount"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  aria-invalid={errors.feeAmount ? true : undefined}
                />
              )}
            />
            <FormFieldError id="cancel-fee-amount-error" message={errors.feeAmount?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cancel-fee-reason" className="text-xs">
              {L.feeReason} <RequiredMark />
            </Label>
            <Input
              id="cancel-fee-reason"
              maxLength={DELIVERY_FAILURE_LIMITS.feeReasonMax}
              aria-invalid={errors.feeReason ? true : undefined}
              {...form.register("feeReason")}
            />
            <FormFieldError id="cancel-fee-reason-error" message={errors.feeReason?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cancel-fee-detail" className="text-xs">
              {L.feeDetail} <RequiredMark />
            </Label>
            <Textarea
              id="cancel-fee-detail"
              rows={3}
              maxLength={DELIVERY_FAILURE_LIMITS.feeDetailMax}
              aria-invalid={errors.feeDetail ? true : undefined}
              {...form.register("feeDetail")}
            />
            <FormFieldError id="cancel-fee-detail-error" message={errors.feeDetail?.message} />
          </div>
          <FeeBearerField
            value={bearer === "CUSTOMER" || bearer === "COMPANY" ? bearer : ""}
            onChange={(value) =>
              form.setValue("feeBearer", value, { shouldValidate: true, shouldTouch: true })
            }
            error={errors.feeBearer?.message}
          />
        </div>
      )}
    </fieldset>
  );
}
