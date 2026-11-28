"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray } from "react-hook-form";

import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { formatMoney } from "@/lib/format";
import { formatDate } from "@/lib/format/date";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { COMBOBOX_ITEM_CLASS, InputCombobox } from "@/components/shared/InputCombobox";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Button } from "@/components/ui/button";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

import { installmentTitle, receiptFormTotal } from "../selectors";

import type { Control, FieldErrors, UseFormSetValue } from "react-hook-form";
import type { Installment, ReceiptFormValues } from "../types";

const L = PAYMENT_LABELS.recordDialog;
/** Số đợt hiện cùng lúc trong danh sách tìm (R1: 8–10 dòng, còn nữa thì nhắc gõ thêm). */
const PICKER_MAX_ROWS = 10;

/** dòng phụ của một đợt: ("SO-…" khi cần,) hợp đồng, hạn trả, số còn phải thu. */
function installmentDetail(choice: Installment, currency: string, withOrder = false): string {
  return [
    withOrder ? choice.orderNumber : null,
    choice.contractNumber,
    choice.dueDate ? L.optionDue(formatDate(choice.dueDate)) : null,
    L.optionOutstanding(formatMoney(choice.outstanding, currency)),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Gõ số đơn, số hợp đồng hoặc tên đợt để tìm; nhóm theo đơn (R1, S07-3). */
function matches(choice: Installment, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [choice.orderNumber, choice.contractNumber, installmentTitle(choice)].some((text) =>
    text.toLowerCase().includes(q),
  );
}

function InstallmentPicker({
  id,
  value,
  onChange,
  options,
  all,
  currency,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (installmentId: string) => void;
  /** Các đợt còn chọn được cho dòng này (đã bỏ đợt ở dòng khác). */
  options: readonly Installment[];
  all: readonly Installment[];
  currency: string;
  invalid: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const chosen = all.find((choice) => choice.installmentId === value);
  const found = options.filter((choice) => matches(choice, query));
  const shown = found.slice(0, PICKER_MAX_ROWS);
  const byOrder = new Map<string, Installment[]>();
  for (const choice of shown)
    byOrder.set(choice.orderNumber, [...(byOrder.get(choice.orderNumber) ?? []), choice]);
  return (
    <InputCombobox
      id={id}
      open={open}
      onOpenChange={setOpen}
      displayValue={chosen ? `${chosen.orderNumber} · ${installmentTitle(chosen)}` : ""}
      placeholder={L.pickInstallment}
      searchPlaceholder={L.searchInstallment}
      ariaLabel={L.installmentLabel}
      search={query}
      onSearchChange={setQuery}
      shouldFilter={false}
      hasError={invalid}
      describedBy={describedBy}
    >
      <CommandList>
        {found.length === 0 && (
          <CommandEmpty className="text-ink-tertiary px-3 py-2 text-left text-[0.8125rem]">
            {L.noInstallmentMatch}
          </CommandEmpty>
        )}
        {[...byOrder.entries()].map(([orderNumber, group]) => (
          <CommandGroup key={orderNumber} heading={`${L.orderGroup} ${orderNumber}`}>
            {group.map((choice) => (
              <CommandItem
                key={choice.installmentId}
                value={choice.installmentId}
                onSelect={() => {
                  onChange(choice.installmentId);
                  setOpen(false);
                }}
                className={`${COMBOBOX_ITEM_CLASS} flex-col items-start gap-0`}
              >
                <span className="text-ink-primary text-[0.8125rem] font-medium">
                  {installmentTitle(choice)}
                </span>
                <span className="text-ink-tertiary text-xs">
                  {installmentDetail(choice, currency)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        {found.length > shown.length && (
          <p className="text-ink-tertiary border-border-default border-t px-3 py-1.5 text-xs">
            {L.moreInstallments(found.length - shown.length)}
          </p>
        )}
      </CommandList>
    </InputCombobox>
  );
}

/**
 * Các dòng của phiếu thu (docs 15 §3, BR-05): mỗi dòng một đợt của khách với số tiền > 0, mặc định
 * điền đúng số còn phải thu; không chọn một đợt hai lần. `choices` đã lọc đợt còn nhận tiền.
 *
 * Mở từ một đợt thì dòng đầu là chữ chỉ đọc ("Đợt 1 — Đặt cọc khi ký · hạn …", R6): kế toán chỉ nhập số tiền. Muốn trả
 * thêm đợt khác của cùng khách (BR-05: một phiếu nhiều dòng) thì bấm "Thêm đợt khác" — các dòng thêm là ô chọn có tìm
 * theo số đơn / hợp đồng, nhóm theo đơn. Thùng rác chỉ hiện khi có từ hai dòng.
 */
export function ReceiptLinesEditor({
  control,
  setValue,
  errors,
  choices,
  watched,
  currency,
  fixedInstallmentId,
}: {
  control: Control<ReceiptFormValues>;
  setValue: UseFormSetValue<ReceiptFormValues>;
  errors: FieldErrors<ReceiptFormValues>;
  choices: readonly Installment[];
  watched: ReceiptFormValues["lines"];
  currency: string;
  /** Đợt mở hộp thoại từ đó: dòng đầu của nó hiện chữ chỉ đọc. */
  fixedInstallmentId?: string;
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
        const fixed = !!fixedInstallmentId && watched[index]?.installmentId === fixedInstallmentId;
        return (
          <div
            key={field.id}
            className="grid grid-cols-[minmax(0,1fr)_10rem_auto] items-start gap-2"
          >
            {fixed && selected ? (
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-ink-secondary text-xs font-medium">{L.installmentLabel}</span>
                <p className="text-ink-primary text-[0.8125rem] font-medium">
                  {installmentTitle(selected)}
                </p>
                <p className="text-ink-tertiary text-xs">
                  {installmentDetail(selected, currency, true)}
                </p>
              </div>
            ) : (
              <FormField
                id={`line-${index}-installment`}
                label={L.installmentLabel}
                required
                error={lineErrors?.installmentId?.message}
                hint={selected && installmentDetail(selected, currency, true)}
              >
                <Controller
                  control={control}
                  name={`lines.${index}.installmentId`}
                  render={({ field: f }) => (
                    <InstallmentPicker
                      id={`line-${index}-installment`}
                      value={f.value}
                      onChange={(value) => {
                        f.onChange(value);
                        const next = choices.find((c) => c.installmentId === value);
                        if (next) setValue(`lines.${index}.amount`, String(next.outstanding));
                      }}
                      options={options}
                      all={choices}
                      currency={currency}
                      invalid={!!lineErrors?.installmentId?.message}
                      describedBy={
                        fieldA11y(
                          `line-${index}-installment`,
                          lineErrors?.installmentId?.message,
                          !!selected,
                        )["aria-describedby"]
                      }
                    />
                  )}
                />
              </FormField>
            )}
            <FormField
              id={`line-${index}-amount`}
              label={L.amountLabel}
              required
              error={lineErrors?.amount?.message}
            >
              <Controller
                control={control}
                name={`lines.${index}.amount`}
                render={({ field: amount }) => (
                  <MoneyInput
                    name={amount.name}
                    ref={amount.ref}
                    value={amount.value}
                    onChange={amount.onChange}
                    onBlur={amount.onBlur}
                    suffix={currency === "VND" ? "₫" : currency}
                    {...fieldA11y(`line-${index}-amount`, lineErrors?.amount?.message)}
                  />
                )}
              />
            </FormField>
            {fields.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${L.removeLine} ${index + 1}`}
                onClick={() => remove(index)}
                className="mt-5"
              >
                <Trash2 className="size-3.5" />
              </Button>
            ) : (
              <span aria-hidden="true" className="w-7" />
            )}
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
