"use client";

import { useState } from "react";

import { PRODUCTION_LABELS } from "@/constants";
import { todayIso } from "@/lib/date-range";

import { productionOrderErrorMessage } from "@/features/production-order/errors";
import { useRecordPhysicalSample } from "@/features/production-order/sample-hooks";
import { physicalSampleInput } from "@/features/production-order/sample-schemas";

import { DatePicker } from "@/components/shared/DatePicker";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";

const S = PRODUCTION_LABELS.sample;

/** Ghi ngày gửi mẫu vật cho khách của vòng đang chờ (docs 17 §4.3 bước 9: mẫu vật tuỳ chọn). Không sau hôm nay. */
export function PhysicalSampleDialog({
  orderId,
  roundId,
  initial,
  onClose,
}: {
  orderId: string;
  roundId: string;
  initial: string | null | undefined;
  onClose: () => void;
}) {
  const record = useRecordPhysicalSample();
  const [sentOn, setSentOn] = useState(initial ?? "");
  const [error, setError] = useState<string | null>(null);
  const check = physicalSampleInput.safeParse({ sentOn });
  const fieldError = sentOn && !check.success ? check.error.issues[0]?.message : undefined;

  return (
    <FormDialog open onOpenChange={(next) => !next && !record.isPending && onClose()}>
      <FormDialogBody
        title={S.physicalTitle}
        description={S.physicalSentOn}
        submitLabel={S.submitPhysical}
        canSubmit={check.success}
        isPending={record.isPending}
        error={error}
        onSubmit={() =>
          record.mutate(
            { orderId, roundId, sentOn },
            {
              onSuccess: onClose,
              onError: (failure) => setError(productionOrderErrorMessage(failure)),
            },
          )
        }
        onCancel={onClose}
      >
        <FormField id="physical-sent-on" label={S.physicalSentOn} required error={fieldError}>
          <DatePicker
            id="physical-sent-on"
            value={sentOn}
            onChange={setSentOn}
            max={todayIso()}
            autoFocus
          />
        </FormField>
      </FormDialogBody>
    </FormDialog>
  );
}
