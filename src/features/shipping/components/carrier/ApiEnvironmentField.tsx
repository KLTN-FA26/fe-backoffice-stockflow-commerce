"use client";

import { Controller } from "react-hook-form";

import { CARRIER_API_ENVIRONMENTS, UI_LABELS } from "@/constants";
import { FormSelect } from "@/components/shared/FormSelect";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { FieldError } from "../primitives";

import type { UseFormReturn } from "react-hook-form";
import type { CarrierFormInput, CarrierValues } from "@/features/shipping/types";

const A = UI_LABELS.shipping.waybill.carriers.config.api;
const TRIGGER =
  "border-border-default bg-bg-surface h-8 w-full rounded-[var(--r-sm)] text-[0.8125rem]";

/** Môi trường gọi API của hãng: thử nghiệm hoặc chạy thật. */
export function ApiEnvironmentField({
  form,
}: {
  form: UseFormReturn<CarrierFormInput, unknown, CarrierValues>;
}) {
  const error = form.formState.errors.apiEnvironment?.message;
  return (
    <div>
      <Label
        htmlFor="carrier-apiEnvironment"
        className="text-ink-secondary mb-1 block text-xs font-medium"
      >
        {A.environment} <span className="text-danger">*</span>
      </Label>
      <Controller
        control={form.control}
        name="apiEnvironment"
        render={({ field }) => (
          <FormSelect value={field.value ?? ""} onValueChange={field.onChange}>
            <SelectTrigger
              id="carrier-apiEnvironment"
              aria-invalid={error ? true : undefined}
              className={TRIGGER}
            >
              <SelectValue placeholder={A.environmentPlaceholder} />
            </SelectTrigger>
            <TitledSelectContent title={A.environment}>
              {CARRIER_API_ENVIRONMENTS.map((value) => (
                <SelectItem key={value} value={value}>
                  {A.environmentOption[value]}
                </SelectItem>
              ))}
            </TitledSelectContent>
          </FormSelect>
        )}
      />
      <FieldError>{error}</FieldError>
    </div>
  );
}
