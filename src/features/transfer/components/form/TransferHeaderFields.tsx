"use client";

import { Controller } from "react-hook-form";

import {
  DELIVERY_MODES,
  TRANSFER_DELIVERY_MODE_LABELS,
  TRANSFER_REASON_LABELS,
  TRANSFER_REASONS,
  UI_LABELS,
} from "@/constants";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";

import { fieldClass } from "../primitives";
import { Field } from "./FormField";
import { WarehouseField } from "./WarehouseField";

import type { UseFormReturn } from "react-hook-form";
import type { TransferFormInput, TransferFormValues } from "@/features/transfer/types";

type TransferForm = UseFormReturn<TransferFormInput, unknown, TransferFormValues>;

const NO_REASON = "__none__";

/** Phần đầu lệnh: kho nguồn / đích (BR-01 khác nhau), lý do, ngày dự kiến. */
export function TransferHeaderFields({ form }: { form: TransferForm }) {
  const errors = form.formState.errors;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <WarehouseField
        form={form}
        name="fromWarehouseId"
        label={UI_LABELS.transfer.field.fromWarehouse}
      />
      <WarehouseField
        form={form}
        name="toWarehouseId"
        label={UI_LABELS.transfer.field.toWarehouse}
      />
      <Field id="transfer-reason" label={UI_LABELS.transfer.field.reason}>
        <Controller
          control={form.control}
          name="reason"
          render={({ field }) => (
            <Select
              value={field.value || NO_REASON}
              onValueChange={(v) => field.onChange(v === NO_REASON ? "" : v)}
            >
              <SelectTrigger
                ref={field.ref}
                onBlur={field.onBlur}
                id="transfer-reason"
                className={fieldClass()}
              >
                <SelectValue />
              </SelectTrigger>
              <TitledSelectContent title={UI_LABELS.transfer.field.reason}>
                <SelectGroup>
                  <SelectItem value={NO_REASON}>{UI_LABELS.transfer.field.noReason}</SelectItem>
                  {TRANSFER_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {TRANSFER_REASON_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </TitledSelectContent>
            </Select>
          )}
        />
      </Field>
      <Field id="transfer-delivery-mode" label={UI_LABELS.transfer.deliveryMode.label}>
        <Controller
          control={form.control}
          name="deliveryMode"
          render={({ field }) => (
            <Select
              // Chưa có giá trị (form dựng không kèm hình thức) = mặc định của BE
              value={field.value ?? "FULL_TRUCKLOAD"}
              onValueChange={(v) =>
                field.onChange(DELIVERY_MODES.find((m) => m === v) ?? "FULL_TRUCKLOAD")
              }
            >
              <SelectTrigger
                ref={field.ref}
                onBlur={field.onBlur}
                id="transfer-delivery-mode"
                className={fieldClass()}
              >
                <SelectValue />
              </SelectTrigger>
              <TitledSelectContent title={UI_LABELS.transfer.deliveryMode.label}>
                <SelectGroup>
                  {DELIVERY_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {TRANSFER_DELIVERY_MODE_LABELS[mode]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </TitledSelectContent>
            </Select>
          )}
        />
      </Field>
      <Field
        id="transfer-expected"
        label={UI_LABELS.transfer.field.expectedDate}
        error={errors.expectedDate?.message}
      >
        <Input
          id="transfer-expected"
          type="date"
          aria-invalid={errors.expectedDate ? true : undefined}
          aria-describedby={errors.expectedDate ? "transfer-expected-error" : undefined}
          className={`${fieldClass(!!errors.expectedDate)} tabular-nums`}
          {...form.register("expectedDate")}
        />
      </Field>
      <p className="text-ink-tertiary text-xs md:col-span-2">
        {UI_LABELS.transfer.deliveryMode.hint} {UI_LABELS.transfer.deliveryMode.editableOnlyInDraft}
      </p>
      <p className="text-ink-tertiary text-xs md:col-span-2">
        {UI_LABELS.transfer.sameWarehouseHint}
      </p>
    </div>
  );
}
