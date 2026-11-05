"use client";

import { Controller } from "react-hook-form";

import {
  ORDER_DELIVERY_FAILURE_LABELS,
  ORDER_DELIVERY_FAILURE_REASONS,
  UI_LABELS,
} from "@/constants";
import { FormSelect } from "@/components/shared/FormSelect";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { FieldError } from "../primitives";

import type { Control } from "react-hook-form";
import type { DeliveryOutcomeFormInput, DeliveryOutcomeValues } from "@/features/shipping/types";

const D = UI_LABELS.shipping.shipment.outcomeDialog;

/** Lý do giao thất bại (BE `DeliveryFailureReason`) — bắt buộc khi kết quả là giao thất bại. */
export function FailureReasonField({
  control,
  error,
}: {
  control: Control<DeliveryOutcomeFormInput, unknown, DeliveryOutcomeValues>;
  error?: string;
}) {
  return (
    <div>
      <Label htmlFor="outcome-reason" className="text-ink-secondary mb-1 block text-xs font-medium">
        {D.reason} <span className="text-danger">*</span>
      </Label>
      <Controller
        control={control}
        name="failureReason"
        render={({ field }) => (
          <FormSelect value={field.value ?? ""} onValueChange={field.onChange}>
            <SelectTrigger
              id="outcome-reason"
              aria-invalid={error ? true : undefined}
              className="border-border-default bg-bg-surface h-8 w-full rounded-[var(--r-sm)] text-[0.8125rem]"
            >
              <SelectValue placeholder={D.reasonPlaceholder} />
            </SelectTrigger>
            <TitledSelectContent title={D.reason}>
              {ORDER_DELIVERY_FAILURE_REASONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {ORDER_DELIVERY_FAILURE_LABELS[value]}
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
