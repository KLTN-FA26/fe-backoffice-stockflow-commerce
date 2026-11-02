"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { sampleErrorMessage } from "@/features/sample-request/errors";
import { useUpdateSample } from "@/features/sample-request/mutations";
import { sampleCreateInputSchema } from "@/features/sample-request/schemas";

import { FormDialogBody } from "@/components/shared/FormDialog";

import { SampleSpecFields } from "../SampleSpecFields";

import type {
  SampleCreateOutput,
  SampleCreateValues,
  SampleDetail,
} from "@/features/sample-request/types";

export function EditSpecForm({ sample, onClose }: { sample: SampleDetail; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateSample();
  const form = useForm<SampleCreateValues, unknown, SampleCreateOutput>({
    resolver: zodResolver(sampleCreateInputSchema),
    defaultValues: {
      customerId: sample.customerId,
      quoteId: sample.quoteId ?? "",
      designSnapshotId: sample.specification.designSnapshotId,
      blankSku: sample.specification.blankSku,
      quantity: String(sample.specification.quantity),
      dueDate: sample.specification.dueDate ?? "",
    },
  });
  const customerId = useWatch({ control: form.control, name: "customerId" });
  const submit = form.handleSubmit((values) =>
    update.mutate(
      { id: sample.id, values },
      { onSuccess: onClose, onError: (failure) => setError(sampleErrorMessage(failure)) },
    ),
  );
  return (
    <FormDialogBody
      title="Sửa quy cách mẫu"
      description="Chỉ sửa được khi yêu cầu còn nháp."
      submitLabel="Lưu"
      canSubmit
      isPending={update.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <SampleSpecFields
        control={form.control}
        register={form.register}
        errors={form.formState.errors}
        customerId={customerId}
      />
    </FormDialogBody>
  );
}
