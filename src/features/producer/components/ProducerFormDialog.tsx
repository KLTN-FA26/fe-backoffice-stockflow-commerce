"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PRODUCTION_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { producerBodyOf, producerFormValuesOf } from "@/features/producer/api";
import { producerErrorMessage } from "@/features/producer/errors";
import { useCreateProducer, useUpdateProducer } from "@/features/producer/mutations";
import { producerFormSchema } from "@/features/producer/schemas";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { ProducerFields } from "./ProducerFields";

import type { Producer, ProducerFormValues } from "@/features/producer/types";

const F = PRODUCTION_LABELS.producer.form;
const SERVER_FIELDS = ["code", "name", "email", "contactName", "contactPhone", "note"] as const;

/**
 * Thêm hoặc sửa đơn vị sản xuất (`POST` / `PUT /producers`). Mã khoá khi sửa. Sửa gửi `version` đã đọc; 409
 * OPTIMISTIC_LOCK → mutation tải lại danh sách, dialog báo để người dùng mở lại bản mới.
 */
export function ProducerFormDialog({
  producer,
  onClose,
}: {
  producer?: Producer;
  onClose: () => void;
}) {
  return (
    <FormDialog open onOpenChange={(next) => !next && onClose()}>
      <ProducerForm producer={producer} onClose={onClose} />
    </FormDialog>
  );
}

function ProducerForm({ producer, onClose }: { producer?: Producer; onClose: () => void }) {
  const create = useCreateProducer();
  const update = useUpdateProducer();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ProducerFormValues>({
    resolver: zodResolver(producerFormSchema(Boolean(producer))),
    mode: "onChange",
    defaultValues: producerFormValuesOf(producer),
  });

  const submit = form.handleSubmit((values) => {
    setServerError(null);
    const handlers = {
      onSuccess: onClose,
      onError: (error: unknown) => {
        setServerError(producerErrorMessage(error));
        if (!(error instanceof ApiError)) return;
        if (error.code === "PRODUCER_CODE_TAKEN")
          form.setError("code", { type: "server", message: producerErrorMessage(error) });
        for (const name of SERVER_FIELDS) {
          const message = error.fieldErrors?.[name];
          if (message) form.setError(name, { type: "server", message });
        }
      },
    };
    const body = producerBodyOf(values, producer);
    if (producer) update.mutate({ id: producer.id, body }, handlers);
    else create.mutate(body, handlers);
  });

  return (
    <FormDialogBody
      title={producer ? `${F.editTitle} ${producer.code}` : F.createTitle}
      description={producer ? F.editDescription : F.createDescription}
      submitLabel={producer ? F.submitEdit : F.submitCreate}
      canSubmit={form.formState.isValid}
      isPending={create.isPending || update.isPending}
      error={serverError}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <ProducerFields form={form} editing={Boolean(producer)} />
    </FormDialogBody>
  );
}
