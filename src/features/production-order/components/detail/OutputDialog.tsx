"use client";

import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";

import { productionErrorMessage } from "@/features/production-order/errors";
import { PRINT_SCRAP_REASONS, outputInputSchema } from "@/features/production-order/input-schemas";
import { useRecordOutput } from "@/features/production-order/mutations";
import { SCRAP_REASON_LABEL, printableBlanks } from "@/features/production-order/selectors";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { z } from "zod";
import type { ProductionDetail } from "@/features/production-order/types";

type Values = z.input<ReturnType<typeof outputInputSchema>>;
const NUM = `${FORM_INPUT_CLASS} text-right tabular-nums`;

function OutputForm({ order, onClose }: { order: ProductionDetail; onClose: () => void }) {
  const max = printableBlanks(order);
  const [error, setError] = useState<string | null>(null);
  const record = useRecordOutput();
  const form = useForm<Values>({
    resolver: zodResolver(outputInputSchema(max)),
    defaultValues: { printed: "", scrap: [] },
  });
  const scrap = useFieldArray({ control: form.control, name: "scrap" });
  const { errors } = form.formState;
  const submit = form.handleSubmit((values) =>
    record.mutate(
      {
        id: order.summary.id,
        printed: Number(values.printed),
        scrap: values.scrap.map((line) => ({
          reason: line.reason,
          quantity: Number(line.quantity),
          ...(line.note ? { note: line.note } : {}),
        })),
      },
      { onSuccess: onClose, onError: (failure) => setError(productionErrorMessage(failure)) },
    ),
  );

  return (
    <FormDialogBody
      title={`Ghi sản lượng — ${order.summary.orderNumber}`}
      description={`Số đã in lần này (gồm cả phế). Tối đa ${max} phôi đã xuất còn chưa in. Phế phẩm trừ kho ngay và ghi theo lý do (BR-PRD-04).`}
      submitLabel="Ghi sản lượng"
      canSubmit
      isPending={record.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <FormField
        id="output-printed"
        label="Số đã in (cái)"
        required
        error={errors.printed?.message}
      >
        <Input
          {...form.register("printed")}
          {...fieldA11y("output-printed", errors.printed?.message)}
          inputMode="numeric"
          autoFocus
          className={NUM}
        />
      </FormField>
      <fieldset className="space-y-2">
        <legend className="text-ink-secondary text-xs font-medium">Phế phẩm</legend>
        {scrap.fields.map((field, index) => {
          const lineErrors = errors.scrap?.[index];
          return (
            <div key={field.id} className="grid grid-cols-[1.2fr_0.8fr_auto] gap-2">
              <select
                aria-label={`Lý do phế ${index + 1}`}
                {...form.register(`scrap.${index}.reason`)}
                className={`${FORM_INPUT_CLASS} border px-2`}
              >
                {PRINT_SCRAP_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {SCRAP_REASON_LABEL[reason]}
                  </option>
                ))}
              </select>
              <Input
                aria-label={`Số phế ${index + 1}`}
                {...form.register(`scrap.${index}.quantity`)}
                inputMode="numeric"
                className={NUM}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Xoá dòng phế ${index + 1}`}
                onClick={() => scrap.remove(index)}
              >
                <Trash2 className="size-4" />
              </Button>
              <Input
                aria-label={`Ghi chú phế ${index + 1}`}
                placeholder="Ghi chú (bắt buộc với lý do khác)"
                {...form.register(`scrap.${index}.note`)}
                className={`${FORM_INPUT_CLASS} col-span-3`}
              />
              {(lineErrors?.quantity || lineErrors?.note) && (
                <p className="text-danger col-span-3 text-xs">
                  {lineErrors.quantity?.message ?? lineErrors.note?.message}
                </p>
              )}
            </div>
          );
        })}
        {errors.scrap?.root?.message && (
          <p className="text-danger text-xs">{errors.scrap.root.message}</p>
        )}
        {errors.scrap?.message && <p className="text-danger text-xs">{errors.scrap.message}</p>}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => scrap.append({ reason: "PRINT_DEFECT", quantity: "", note: "" })}
        >
          <Plus className="size-3.5" /> Thêm dòng phế
        </Button>
      </fieldset>
    </FormDialogBody>
  );
}

export function OutputDialog({
  order,
  open,
  onOpenChange,
}: {
  order: ProductionDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && <OutputForm order={order} onClose={() => onOpenChange(false)} />}
    </FormDialog>
  );
}
