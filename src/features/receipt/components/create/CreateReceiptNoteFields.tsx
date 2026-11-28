"use client";

import { PRODUCTION_RECEIPT_LIMITS, RECEIPT_COUNT_LABELS } from "@/constants";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_INPUT_CLASS, FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { UseFormReturn } from "react-hook-form";
import type {
  ProductionReceiptCreateInput,
  ProductionReceiptCreateValues,
} from "@/features/receipt/types";

const L = RECEIPT_COUNT_LABELS.create;
const NOTE_ID = "gr-delivery-note";
const REMARK_ID = "gr-note";

/** Số phiếu giao và ghi chú của phiếu nhập mới — hai ô tuỳ chọn dưới ô chọn Đơn sản xuất. */
export function CreateReceiptNoteFields({
  form,
}: {
  form: UseFormReturn<ProductionReceiptCreateValues, unknown, ProductionReceiptCreateInput>;
}) {
  const { errors } = form.formState;
  return (
    <>
      <FormField id={NOTE_ID} label={L.deliveryNote} error={errors.deliveryNote?.message}>
        <Input
          placeholder={L.deliveryNotePlaceholder}
          maxLength={PRODUCTION_RECEIPT_LIMITS.deliveryNoteMax}
          className={FORM_INPUT_CLASS}
          {...fieldA11y(NOTE_ID, errors.deliveryNote?.message)}
          {...form.register("deliveryNote")}
        />
      </FormField>
      <FormField id={REMARK_ID} label={L.note} error={errors.note?.message}>
        <Textarea
          rows={2}
          maxLength={PRODUCTION_RECEIPT_LIMITS.noteMax}
          className={FORM_TEXTAREA_CLASS}
          {...fieldA11y(REMARK_ID, errors.note?.message)}
          {...form.register("note")}
        />
      </FormField>
    </>
  );
}
