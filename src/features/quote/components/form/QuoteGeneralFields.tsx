"use client";

import { Controller, useWatch } from "react-hook-form";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

import { todayVn } from "@/features/quote/form-schemas";
import { CustomerPicker } from "@/components/backoffice/CustomerPicker";
import { Card } from "@/components/shared/Card";
import { DatePicker } from "@/components/shared/DatePicker";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { Textarea } from "@/components/ui/textarea";

import type { UseFormReturn } from "react-hook-form";
import type { QuoteFormValues } from "@/features/quote/types";

/** Ngày sau `iso` (`YYYY-MM-DD`): hiệu lực phải ở tương lai (BE, form-schemas). */
function nextDay(iso: string): string {
  return format(addDays(parseISO(iso), 1), "yyyy-MM-dd");
}

/**
 * "Thông tin chung" của báo giá: khách, hiệu lực, ngày giao khách yêu cầu, điều khoản. Ngày chọn bằng `DatePicker`
 * dd/MM/yyyy (BO-UX-3) — form vẫn giữ `YYYY-MM-DD` gửi BE.
 */
export function QuoteGeneralFields({
  form,
  customerLocked,
}: {
  form: UseFormReturn<QuoteFormValues>;
  customerLocked: boolean;
}) {
  const { control, formState, register } = form;
  const { errors } = formState;
  const today = todayVn();
  const validUntil = useWatch({ control, name: "validUntil" });
  // "còn N ngày" kể từ hôm nay cạnh ô hiệu lực — Sale thấy ngay hạn điền sẵn là bao lâu (R6).
  const daysLeft = /^\d{4}-\d{2}-\d{2}$/.test(validUntil ?? "")
    ? differenceInCalendarDays(parseISO(validUntil), parseISO(today))
    : null;
  return (
    <Card className="grid gap-4 md:grid-cols-2">
      <h2 className="text-ink-primary text-sm font-semibold md:col-span-2">Thông tin chung</h2>
      <Controller
        control={control}
        name="customerId"
        render={({ field }) => (
          <CustomerPicker
            idPrefix="quote"
            value={field.value}
            onChange={field.onChange}
            error={errors.customerId?.message}
            locked={customerLocked}
          />
        )}
      />
      <FormField
        id="quote-valid"
        label="Hiệu lực đến hết ngày"
        required
        error={errors.validUntil?.message}
        hint={daysLeft !== null && daysLeft > 0 ? `Còn ${daysLeft} ngày kể từ hôm nay.` : undefined}
      >
        <Controller
          control={control}
          name="validUntil"
          render={({ field }) => (
            <DatePicker
              ref={field.ref}
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              min={nextDay(today)}
              {...fieldA11y(
                "quote-valid",
                errors.validUntil?.message,
                daysLeft !== null && daysLeft > 0,
              )}
            />
          )}
        />
      </FormField>
      <FormField
        id="quote-delivery"
        label="Ngày giao khách yêu cầu"
        error={errors.requestedDeliveryDate?.message}
        hint="Tuỳ chọn, không ở quá khứ."
      >
        <Controller
          control={control}
          name="requestedDeliveryDate"
          render={({ field }) => (
            <DatePicker
              ref={field.ref}
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              min={today}
              clearable
              {...fieldA11y("quote-delivery", errors.requestedDeliveryDate?.message, true)}
            />
          )}
        />
      </FormField>
      <FormField
        id="quote-terms"
        label="Điều khoản"
        error={errors.terms?.message}
        className="md:col-span-2"
      >
        <Textarea
          {...register("terms")}
          {...fieldA11y("quote-terms", errors.terms?.message)}
          rows={3}
          maxLength={2000}
        />
      </FormField>
    </Card>
  );
}
