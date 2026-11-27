"use client";

import { Controller, useWatch } from "react-hook-form";

import { PRODUCTION_LABELS } from "@/constants";
import { useProducerDirectory } from "@/lib/references/producer-options";

import { CheckboxField } from "@/components/shared/CheckboxField";
import { DatePicker } from "@/components/shared/DatePicker";
import { FORM_SELECT_CLASS, FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { fieldA11y, FormField } from "@/components/shared/FormField";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/combobox-select";
import { Textarea } from "@/components/ui/textarea";

import type { UseFormReturn } from "react-hook-form";
import type { ProductionOrderEditValues } from "@/features/production-order/types";

const E = PRODUCTION_LABELS.edit;

/** Phần đầu đơn của form sửa nháp: đơn vị sản xuất, ngày cần hàng, cờ duyệt mẫu + lý do tắt, ghi chú. */
export function EditHeaderFields({ form }: { form: UseFormReturn<ProductionOrderEditValues> }) {
  const { active, byId } = useProducerDirectory();
  const errors = form.formState.errors;
  const [producerId, sampleOn, byDefault] = useWatch({
    control: form.control,
    name: ["producerId", "sampleApprovalRequired", "sampleRequiredByDefault"],
  });
  // Đơn vị hiện tại có thể đã ngừng dùng: vẫn hiện để không mất giá trị, nhưng chỉ đơn vị ACTIVE chọn mới được
  const current = byId(producerId);
  const options = current && current.status !== "ACTIVE" ? [current, ...active] : active;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Controller
        control={form.control}
        name="producerId"
        render={({ field }) => (
          <FormField
            id="edit-producer"
            label={E.producer}
            required
            error={errors.producerId?.message}
          >
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="edit-producer" className={FORM_SELECT_CLASS}>
                <SelectValue placeholder={E.producerPlaceholder} />
              </SelectTrigger>
              <TitledSelectContent title={E.producer}>
                {options.map((producer) => (
                  <SelectItem
                    key={producer.id}
                    value={producer.id}
                    disabled={producer.status !== "ACTIVE"}
                  >
                    {producer.code} · {producer.name}
                  </SelectItem>
                ))}
              </TitledSelectContent>
            </Select>
          </FormField>
        )}
      />
      <Controller
        control={form.control}
        name="needByDate"
        render={({ field }) => (
          <FormField
            id="edit-need-by"
            label={E.needBy}
            required
            hint={E.needByHint}
            error={errors.needByDate?.message}
          >
            <DatePicker id="edit-need-by" value={field.value} onChange={field.onChange} />
          </FormField>
        )}
      />
      <CheckboxField
        control={form.control}
        name="sampleApprovalRequired"
        id="edit-sample"
        label={E.sample}
        className="sm:col-span-2"
        // BR-24: bật / tắt cờ đổi việc lý do có bắt buộc không → kiểm lại ô lý do
        onCheckedChange={() => void form.trigger("sampleWaiverReason")}
      />
      {!sampleOn && (
        <FormField
          id="edit-waiver"
          label={E.waiverReason}
          required={byDefault}
          hint={byDefault ? E.waiverHint : undefined}
          error={errors.sampleWaiverReason?.message}
          className="sm:col-span-2"
        >
          <Textarea
            {...fieldA11y("edit-waiver", errors.sampleWaiverReason?.message, byDefault)}
            rows={2}
            className={FORM_TEXTAREA_CLASS}
            {...form.register("sampleWaiverReason")}
          />
        </FormField>
      )}
      <FormField
        id="edit-note"
        label={E.note}
        error={errors.note?.message}
        className="sm:col-span-2"
      >
        <Textarea
          {...fieldA11y("edit-note", errors.note?.message)}
          rows={2}
          className={FORM_TEXTAREA_CLASS}
          {...form.register("note")}
        />
      </FormField>
    </div>
  );
}
