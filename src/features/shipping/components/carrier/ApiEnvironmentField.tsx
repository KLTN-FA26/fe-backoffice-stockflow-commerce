"use client";

import { Controller } from "react-hook-form";

import { CARRIER_API_ENVIRONMENTS, UI_LABELS } from "@/constants";

import { FieldError } from "../primitives";
import { CarrierChoice } from "./CarrierChoice";

import type { UseFormReturn } from "react-hook-form";
import type { CarrierFormInput, CarrierValues } from "@/features/shipping/types";

const A = UI_LABELS.shipping.waybill.carriers.config.api;

/** Môi trường gọi API của hãng: thử nghiệm hoặc chạy thật. */
export function ApiEnvironmentField({
  form,
}: {
  form: UseFormReturn<CarrierFormInput, unknown, CarrierValues>;
}) {
  const error = form.formState.errors.apiEnvironment?.message;
  return (
    <div>
      <p className="text-ink-secondary mb-1 text-xs font-medium">
        {A.environment} <span className="text-danger">*</span>
      </p>
      <Controller
        control={form.control}
        name="apiEnvironment"
        render={({ field }) => (
          <CarrierChoice
            id="carrier-apiEnvironment"
            label={A.environment}
            value={field.value === "" ? undefined : field.value}
            onChange={field.onChange}
            options={CARRIER_API_ENVIRONMENTS.map((value) => ({
              value,
              label: A.environmentOption[value],
            }))}
          />
        )}
      />
      <FieldError>{error}</FieldError>
    </div>
  );
}
