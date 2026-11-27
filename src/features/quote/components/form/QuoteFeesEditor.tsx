"use client";

import { Controller, useWatch } from "react-hook-form";

import { QUOTE_FEE_LABELS } from "@/constants";
import { QUOTE_FORM_LABELS } from "@/constants/labels-quote-form";
import { Card } from "@/components/shared/Card";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { MoneyInput } from "@/components/shared/MoneyInput";

import type { UseFormReturn } from "react-hook-form";
import type { QuoteFormValues } from "@/features/quote/types";

/**
 * Phí của báo giá (14 BR-17, BR-20):
 * - Phí khuôn / bản in: BE tự thêm cho SKU sản xuất lần đầu khi lưu nháp; Sale chỉ nhập tiền (0 = miễn phí),
 *   bắt buộc trước khi gửi. Không cho thêm tay (SKU đã từng sản xuất không có phí khuôn).
 * - Phí vận chuyển: tối đa một dòng, số tiền > 0; ô hiện sẵn, để trống = không thu.
 */
export function QuoteFeesEditor({ form }: { form: UseFormReturn<QuoteFormValues> }) {
  const { control, formState, setValue } = form;
  const plateFees = useWatch({ control, name: "plateFees" });
  const errors = formState.errors;

  return (
    <Card className="space-y-3">
      <h2 className="text-ink-primary text-sm font-semibold">Phí</h2>
      {(plateFees ?? []).length === 0 && (
        <p className="text-ink-tertiary text-[0.8125rem]">
          Phí khuôn được hệ thống tự thêm sau khi lưu nháp nếu có SKU sản xuất lần đầu.
        </p>
      )}
      {(plateFees ?? []).map((fee, index) => {
        const id = `plate-fee-${index}`;
        const error = errors.plateFees?.[index]?.amount?.message;
        return (
          <FormField
            key={fee.sku}
            id={id}
            label={`${QUOTE_FEE_LABELS.PLATE_FEE} — ${fee.sku}`}
            error={error}
            hint={
              fee.amount === "" ? "Bắt buộc nhập trước khi gửi khách (0 = miễn phí)." : undefined
            }
          >
            <Controller
              control={control}
              name={`plateFees.${index}.amount`}
              render={({ field }) => (
                <MoneyInput
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  echo
                  {...fieldA11y(id, error, fee.amount === "")}
                />
              )}
            />
          </FormField>
        );
      })}
      {/* S02-5: ô phí vận chuyển hiện sẵn; để trống = không thu (14 BR-20: tối đa một dòng, số tiền > 0). */}
      <FormField
        id="shipping-fee"
        label={`${QUOTE_FEE_LABELS.SHIPPING_FEE} ${QUOTE_FORM_LABELS.optional}`}
        error={errors.shippingFee?.message}
        hint={QUOTE_FORM_LABELS.shippingFeeHint}
      >
        <Controller
          control={control}
          name="shippingFee"
          render={({ field }) => (
            <MoneyInput
              name={field.name}
              ref={field.ref}
              value={field.value}
              onChange={(digits) => {
                field.onChange(digits);
                // Có số tiền = có dòng phí vận chuyển; trống = không thu.
                setValue("hasShippingFee", digits !== "", { shouldDirty: true });
              }}
              onBlur={field.onBlur}
              echo
              {...fieldA11y("shipping-fee", errors.shippingFee?.message, true)}
            />
          )}
        />
      </FormField>
    </Card>
  );
}
