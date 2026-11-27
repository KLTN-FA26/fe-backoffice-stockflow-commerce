"use client";

import { Controller, useWatch } from "react-hook-form";

import {
  SALES_OWNER_CHANGE_REASON_LABELS,
  SALES_OWNER_LABELS,
} from "@/constants/labels-sales-owner";
import { TRANSFER_REASONS } from "@/constants/sales-owner";

import { ChoiceField } from "@/components/backoffice/ChoiceField";
import { NoteField } from "@/components/backoffice/NoteField";
import { SalesPickerField, salesOptionLabel } from "@/components/backoffice/SalesPickerField";
import { CheckboxField } from "@/components/shared/CheckboxField";

import { useCustomersOf } from "../queries";

import { CheckList } from "./CheckList";

import type { UseFormReturn } from "react-hook-form";
import type { SalesOption } from "@/lib/references/sales-workload";
import type { TransferValues } from "../inputs";

const SCOPES = [
  { value: "all", label: "Mọi khách đang thuộc Sale này" },
  { value: "picked", label: "Chọn một phần khách" },
] as const;

/** Ô của hộp "Chuyển khách…" (BR-S09, §10.1). */
export function TransferFields({
  form,
  sales,
  targets,
}: {
  form: UseFormReturn<TransferValues>;
  /** "Từ Sale" — có thể là người đã nghỉ (BR-S08: giao lại khách của họ). */
  sales: readonly SalesOption[];
  /** "Sang Sale" — chỉ Sale giao được (D42). */
  targets: readonly SalesOption[];
}) {
  const { errors } = form.formState;
  const [from, scope] = useWatch({ control: form.control, name: ["fromUserId", "scope"] });
  const customers = useCustomersOf(from, scope === "picked");
  return (
    <>
      <Controller
        control={form.control}
        name="fromUserId"
        render={({ field }) => (
          <SalesPickerField
            id="transfer-from"
            label="Từ Sale"
            required
            value={field.value}
            onChange={(value) => {
              field.onChange(value);
              form.setValue("customerIds", []);
            }}
            options={sales}
            error={errors.fromUserId?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="toUserIds"
        render={({ field }) => (
          <CheckList
            id="transfer-to"
            label="Sang Sale (nhiều người thì chia đều)"
            options={targets
              .filter((option) => option.userId !== from)
              .map((option) => ({ value: option.userId, label: salesOptionLabel(option) }))}
            selected={field.value}
            onChange={field.onChange}
            error={errors.toUserIds?.message}
          />
        )}
      />
      <fieldset className="m-0 border-0 p-0">
        <legend className="text-ink-secondary mb-1 text-xs font-medium">Khách cần chuyển</legend>
        <div className="flex flex-wrap gap-4">
          {SCOPES.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-[0.8125rem]">
              <input type="radio" value={option.value} {...form.register("scope")} />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      {scope === "picked" && (
        <Controller
          control={form.control}
          name="customerIds"
          render={({ field }) => (
            <CheckList
              id="transfer-customers"
              label="Khách"
              options={(customers.data?.items ?? []).map((c) => ({
                value: c.customerId,
                label: c.fullName,
              }))}
              selected={field.value}
              onChange={field.onChange}
              error={errors.customerIds?.message}
              empty={customers.isPending ? "Đang tải khách…" : "Sale này chưa phụ trách khách nào."}
            />
          )}
        />
      )}
      <Controller
        control={form.control}
        name="reason"
        render={({ field }) => (
          <ChoiceField
            id="transfer-reason"
            label="Lý do"
            required
            placeholder={SALES_OWNER_LABELS.dialog.reasonPlaceholder}
            value={field.value}
            onChange={(value) => {
              field.onChange(value);
              if (value === "TEMPORARY_LEAVE") form.setValue("temporary", true);
            }}
            options={TRANSFER_REASONS.map((value) => ({
              value,
              label: SALES_OWNER_CHANGE_REASON_LABELS[value],
            }))}
            error={errors.reason?.message}
          />
        )}
      />
      <NoteField id="transfer-note" error={errors.note?.message} register={form.register("note")} />
      <div className="space-y-1">
        <CheckboxField
          control={form.control}
          name="temporary"
          label="Lô tạm — trả lại cho Sale cũ khi họ quay lại"
          onCheckedChange={(on) => {
            if (on && !form.getValues("reason")) form.setValue("reason", "TEMPORARY_LEAVE");
          }}
        />
        {errors.temporary?.message && (
          <p role="alert" className="text-danger text-xs">
            {errors.temporary.message}
          </p>
        )}
        <CheckboxField
          control={form.control}
          name="notifyCustomer"
          label="Báo cho khách trong chat"
        />
      </div>
    </>
  );
}
