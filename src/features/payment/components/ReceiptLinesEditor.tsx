"use client";

import { Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray } from "react-hook-form";

import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { formatMoney } from "@/lib/format";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FormSelect } from "@/components/shared/FormSelect";
import { FORM_INPUT_CLASS, FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { installmentTitle, receiptFormTotal } from "../selectors";

import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";
import type { Installment, ReceiptFormValues } from "../types";

const L = PAYMENT_LABELS.recordDialog;

/**
 * Các dòng của phiếu thu (docs 15 §3, BR-05): mỗi dòng một đợt của khách với số tiền > 0, mặc định
 * điền đúng số còn phải thu; không chọn một đợt hai lần. `choices` đã lọc đợt còn nhận tiền.
 */
export function ReceiptLinesEditor({
  control,
  register,
  setValue,
  errors,
  choices,
  watched,
  currency,
}: {
  control: Control<ReceiptFormValues>;
  register: UseFormRegister<ReceiptFormValues>;
  setValue: UseFormSetValue<ReceiptFormValues>;
  errors: FieldErrors<ReceiptFormValues>;
  choices: readonly Installment[];
  watched: ReceiptFormValues["lines"];
  currency: string;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const taken = new Set(watched.map((line) => line.installmentId));
  const free = choices.filter((choice) => !taken.has(choice.installmentId));

  return (
    <fieldset className="space-y-3">
      <legend className="text-ink-primary text-sm font-semibold">{L.linesTitle}</legend>
      {fields.map((field, index) => {
        const lineErrors = errors.lines?.[index];
        const options = choices.filter(
          (choice) =>
            choice.installmentId === watched[index]?.installmentId ||
            !taken.has(choice.installmentId),
        );
        const selected = choices.find((c) => c.installmentId === watched[index]?.installmentId);
        return (
          <div
            key={field.id}
            className="grid grid-cols-[minmax(0,1fr)_9rem_auto] items-start gap-2"
          >
            <FormField
              id={`line-${index}-installment`}
              label={L.installmentLabel}
              required
              error={lineErrors?.installmentId?.message}
              hint={selected && L.outstandingOf(formatMoney(selected.outstanding, currency))}
            >
              <Controller
                control={control}
                name={`lines.${index}.installmentId`}
                render={({ field: f }) => (
                  <FormSelect
                    value={f.value}
                    onValueChange={(value) => {
                      f.onChange(value);
                      const next = choices.find((c) => c.installmentId === value);
                      if (next) setValue(`lines.${index}.amount`, String(next.outstanding));
                    }}
                  >
                    <SelectTrigger
                      {...fieldA11y(
                        `line-${index}-installment`,
                        lineErrors?.installmentId?.message,
                        !!selected,
                      )}
                      className={FORM_SELECT_CLASS}
                    >
                      <SelectValue placeholder={L.pickInstallment} />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((choice) => (
                        <SelectItem key={choice.installmentId} value={choice.installmentId}>
                          {choice.contractNumber} · {installmentTitle(choice)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </FormSelect>
                )}
              />
            </FormField>
            <FormField
              id={`line-${index}-amount`}
              label={L.amountLabel}
              required
              error={lineErrors?.amount?.message}
            >
              <Input
                inputMode="numeric"
                className={`${FORM_INPUT_CLASS} text-right tabular-nums`}
                {...fieldA11y(`line-${index}-amount`, lineErrors?.amount?.message)}
                {...register(`lines.${index}.amount`)}
              />
            </FormField>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`${L.removeLine} ${index + 1}`}
              disabled={fields.length === 1}
              onClick={() => remove(index)}
              className="mt-5"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        );
      })}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={free.length === 0}
          title={free.length === 0 ? L.noMoreInstallments : undefined}
          onClick={() => append({ installmentId: "", amount: "" })}
        >
          <Plus className="size-3.5" /> {L.addLine}
        </Button>
        <p className="text-ink-primary text-[0.8125rem]">
          {L.total}:{" "}
          <span className="font-semibold tabular-nums">
            {formatMoney(receiptFormTotal(watched), currency)}
          </span>
        </p>
      </div>
    </fieldset>
  );
}
