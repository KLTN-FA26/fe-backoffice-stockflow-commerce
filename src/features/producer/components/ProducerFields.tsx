"use client";

import { Controller, useWatch } from "react-hook-form";

import {
  PRODUCER_CHANNEL_LABELS,
  PRODUCER_CHANNELS,
  PRODUCER_STATUS_LABELS,
  PRODUCER_STATUSES,
  PRODUCTION_LABELS,
} from "@/constants";

import { FORM_INPUT_CLASS, FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { fieldA11y, FormField } from "@/components/shared/FormField";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { UseFormReturn } from "react-hook-form";
import type { ProducerFormValues } from "@/features/producer/types";

const F = PRODUCTION_LABELS.producer.form;

type TextName = "code" | "name" | "email" | "contactName" | "contactPhone" | "standardLeadDays";

/** Ô của form đơn vị sản xuất. Mã chỉ nhập khi tạo; trạng thái chỉ chọn khi sửa. */
export function ProducerFields({
  form,
  editing,
}: {
  form: UseFormReturn<ProducerFormValues>;
  editing: boolean;
}) {
  const errors = form.formState.errors;
  const channel = useWatch({ control: form.control, name: "channel" });
  const text = (
    name: TextName,
    label: string,
    opts: { required?: boolean; hint?: string; className?: string; disabled?: boolean } = {},
  ) => {
    const id = `producer-${name}`;
    const error = errors[name]?.message;
    return (
      <FormField id={id} label={label} required={opts.required} hint={opts.hint} error={error}>
        <Input
          {...fieldA11y(id, error, Boolean(opts.hint))}
          autoComplete="off"
          disabled={opts.disabled}
          className={`${FORM_INPUT_CLASS} ${opts.className ?? ""}`}
          {...form.register(name)}
        />
      </FormField>
    );
  };
  const select = <T extends string>(
    name: "channel" | "status",
    label: string,
    values: readonly T[],
    labels: Record<T, string>,
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormField id={`producer-${name}`} label={label} required>
          {/* 2 giá trị cố định: hiện sẵn cả hai, một lần bấm (UX audit S01-6) */}
          <SegmentedControl<string>
            id={`producer-${name}`}
            label={label}
            value={field.value}
            onChange={(value) => field.onChange(value)}
            options={values.map((value) => ({ value, label: labels[value] }))}
          />
        </FormField>
      )}
    />
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {text("code", F.code, {
        required: !editing,
        disabled: editing,
        hint: editing ? undefined : F.codeHint,
        className: "font-[family-name:var(--font-mono)] uppercase",
      })}
      {text("name", F.name, { required: true })}
      {select("channel", F.channel, PRODUCER_CHANNELS, PRODUCER_CHANNEL_LABELS)}
      {text("email", F.email, { required: channel === "EMAIL", hint: F.emailHint })}
      {text("contactName", F.contactName)}
      {text("contactPhone", F.contactPhone)}
      {text("standardLeadDays", F.leadDays, {
        hint: F.leadDaysHint,
        className: "text-right tabular-nums",
      })}
      {editing && select("status", F.status, PRODUCER_STATUSES, PRODUCER_STATUS_LABELS)}
      <FormField
        id="producer-note"
        label={F.note}
        error={errors.note?.message}
        className="sm:col-span-2"
      >
        <Textarea
          {...fieldA11y("producer-note", errors.note?.message)}
          rows={2}
          className={FORM_TEXTAREA_CLASS}
          {...form.register("note")}
        />
      </FormField>
    </div>
  );
}
