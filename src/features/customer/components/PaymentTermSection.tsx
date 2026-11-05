"use client";

import { SALES_ONBOARDING_PAYMENT_TERMS } from "@/constants";

import { PAYMENT_TERM_LABEL } from "@/features/customer/selectors";

import { Card } from "@/components/shared/Card";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { CustomerCreateValues } from "@/features/customer/types";

/**
 * Điều khoản thanh toán lúc tạo khách — B1 (SPRINT2-FINISH-DECISIONS 2026-10-13): Sales chọn
 * PREPAID hoặc DEPOSIT (kèm % cọc thoả thuận); CREDIT do người duyệt công nợ thiết lập sau.
 */
export function PaymentTermSection({
  register,
  errors,
  paymentTerm,
}: {
  register: UseFormRegister<CustomerCreateValues>;
  errors: FieldErrors<CustomerCreateValues>;
  paymentTerm: CustomerCreateValues["paymentTerm"];
}) {
  return (
    <Card className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <h2 className="text-ink-primary text-sm font-semibold">Điều khoản thanh toán</h2>
        <p className="text-ink-tertiary mt-1 text-xs">
          Sales chọn Trả trước hoặc Đặt cọc. Công nợ (hạn mức, số ngày) do người duyệt công nợ thiết
          lập sau trên hồ sơ khách.
        </p>
      </div>
      <fieldset className="flex flex-wrap gap-2 sm:col-span-2">
        <legend className="sr-only">Điều khoản thanh toán</legend>
        {SALES_ONBOARDING_PAYMENT_TERMS.map((term) => (
          <label
            key={term}
            className="border-border-default has-[:checked]:border-brand has-[:focus-visible]:ring-brand/30 flex cursor-pointer items-center gap-2 rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem] has-[:focus-visible]:ring-2"
          >
            <input
              type="radio"
              value={term}
              {...register("paymentTerm")}
              className="accent-[var(--brand)]"
            />
            {PAYMENT_TERM_LABEL[term]}
          </label>
        ))}
      </fieldset>
      {paymentTerm === "DEPOSIT" && (
        <FormField
          id="customer-depositPercent"
          label="Tỷ lệ cọc đã thoả thuận (%)"
          required
          error={errors.depositPercent?.message}
          hint="Lớn hơn 0 và nhỏ hơn 100, tối đa 2 chữ số thập phân."
        >
          <Input
            {...register("depositPercent")}
            {...fieldA11y("customer-depositPercent", errors.depositPercent?.message, true)}
            inputMode="decimal"
            className={`${FORM_INPUT_CLASS} text-right tabular-nums`}
          />
        </FormField>
      )}
    </Card>
  );
}
