"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { productionErrorMessage } from "@/features/production-order/errors";
import { recallInputSchema } from "@/features/production-order/input-schemas";
import { useRecallBlanks } from "@/features/production-order/mutations";

import { LocationField } from "@/components/backoffice/LocationField";
import { FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";

import type { z } from "zod";
import type { ProductionDetail } from "@/features/production-order/types";

export const NUM = `${FORM_INPUT_CLASS} text-right tabular-nums`;

export function RecallForm({ order, onClose }: { order: ProductionDetail; onClose: () => void }) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const recall = useRecallBlanks();
  const form = useForm<z.input<typeof recallInputSchema>>({
    resolver: zodResolver(recallInputSchema),
    defaultValues: { returned: "0", spoilt: "0", returnLocation: "", note: "" },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((v) =>
    recall.mutate(
      {
        id: order.summary.id,
        requestId,
        returned: Number(v.returned),
        spoilt: Number(v.spoilt),
        ...(v.returnLocation ? { returnLocation: v.returnLocation } : {}),
        ...(v.note ? { note: v.note } : {}),
      },
      { onSuccess: onClose, onError: (e) => setError(productionErrorMessage(e)) },
    ),
  );
  return (
    <FormDialogBody
      title="Thu hồi phôi từ nhà gia công"
      description="Ghi số phôi nhận lại và số đã hỏng ở nhà gia công. Không vượt số phôi đang nằm ở nhà gia công."
      submitLabel="Ghi thu hồi"
      canSubmit
      isPending={recall.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <FormField id="recall-returned" label="Phôi trả lại" error={errors.returned?.message}>
        <Input
          {...form.register("returned")}
          {...fieldA11y("recall-returned", errors.returned?.message)}
          inputMode="numeric"
          className={NUM}
          autoFocus
        />
      </FormField>
      <FormField id="recall-spoilt" label="Phôi hỏng" error={errors.spoilt?.message}>
        <Input
          {...form.register("spoilt")}
          {...fieldA11y("recall-spoilt", errors.spoilt?.message)}
          inputMode="numeric"
          className={NUM}
        />
      </FormField>
      <Controller
        control={form.control}
        name="returnLocation"
        render={({ field }) => (
          <LocationField
            id="recall-location"
            label="Vị trí nhận phôi"
            warehouseId={order.summary.warehouseId}
            value={field.value}
            onChange={field.onChange}
            emptyHint="Để trống = về đúng nơi đã gửi đi."
          />
        )}
      />
      <FormField id="recall-note" label="Ghi chú" error={errors.note?.message}>
        <Input
          {...form.register("note")}
          {...fieldA11y("recall-note", errors.note?.message)}
          className={FORM_INPUT_CLASS}
        />
      </FormField>
    </FormDialogBody>
  );
}
