"use client";

import { useState } from "react";

import { PRODUCTION_LABELS, REPRINT_REASON_LABELS, REPRINT_REASONS } from "@/constants";
import { todayIso } from "@/lib/date-range";

import { productionOrderErrorMessage } from "@/features/production-order/errors";
import { useAddSampleMedia, useOpenSampleRound } from "@/features/production-order/sample-hooks";
import { sampleFileProblems } from "@/features/production-order/sample-files";
import { willExceedFreeRounds } from "@/features/production-order/sample-lifecycle";

import { Alert } from "@/components/shared/Alert";
import { DatePicker } from "@/components/shared/DatePicker";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";

import { MediaPicker } from "./MediaPicker";
import { useSampleUpload } from "./useSampleUpload";

import type { ReprintReason } from "@/constants";
import type { SampleRounds } from "@/features/production-order/sample-schemas";

const S = PRODUCTION_LABELS.sample;

/** `first` = vòng 1, `reprint` = vòng in lại (bắt buộc lý do), `add` = thêm tệp cho vòng đang chờ khách. */
export type SampleMediaMode = "first" | "reprint" | "add";

const COPY = {
  first: { title: S.openTitle, description: S.openFirstDescription, submit: S.submitOpen },
  reprint: { title: S.openTitle, description: S.openNextDescription, submit: S.submitOpen },
  add: { title: S.addTitle, description: S.filesHint, submit: S.submitAdd },
} as const;

/**
 * Tải ảnh / video mẫu rồi mở vòng hoặc thêm vào vòng đang chờ (docs 17 §4.3 bước 9, BR-24). Vòng in lại phải phân loại
 * lý do: lỗi in không tính vào số lần in mẫu miễn phí, khách đổi ý thì tính — vượt số lần thì cảnh báo, không chặn.
 */
export function SampleMediaDialog({
  mode,
  view,
  roundId,
  onClose,
}: {
  mode: SampleMediaMode;
  view: SampleRounds;
  roundId?: string;
  onClose: () => void;
}) {
  const open = useOpenSampleRound();
  const add = useAddSampleMedia();
  const { uploadAll, progress } = useSampleUpload(view.productionOrderId);
  const [files, setFiles] = useState<File[]>([]);
  const [reason, setReason] = useState<ReprintReason | null>(null);
  const [sentOn, setSentOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busy = progress !== null || open.isPending || add.isPending;
  const counts = mode === "first" || reason === "CUSTOMER_CHANGE";
  const valid =
    files.length > 0 &&
    sampleFileProblems(files).length === 0 &&
    (mode !== "reprint" || reason !== null);

  const submit = async () => {
    setError(null);
    let uploadIds: string[];
    try {
      uploadIds = await uploadAll(files);
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : S.uploadFailed(""));
      return;
    }
    const handlers = {
      onSuccess: onClose,
      onError: (failure: unknown) => setError(productionOrderErrorMessage(failure)),
    };
    if (mode === "add" && roundId)
      add.mutate({ orderId: view.productionOrderId, roundId, uploadIds }, handlers);
    else
      open.mutate(
        {
          orderId: view.productionOrderId,
          uploadIds,
          physicalSampleSentOn: sentOn || null,
          // BR-24: vòng 1 không có lý do in lại
          reprintReason: mode === "reprint" ? reason : null,
        },
        handlers,
      );
  };

  return (
    <FormDialog open onOpenChange={(next) => !next && !busy && onClose()}>
      <FormDialogBody
        title={COPY[mode].title}
        description={COPY[mode].description}
        submitLabel={progress ? S.uploading(progress.done, progress.total) : COPY[mode].submit}
        canSubmit={valid}
        isPending={busy}
        error={error}
        onSubmit={() => void submit()}
        onCancel={onClose}
      >
        {mode === "reprint" && (
          <fieldset className="space-y-1.5">
            <legend className="text-ink-secondary mb-1 text-xs font-medium">
              {S.reprintReason} *
            </legend>
            {REPRINT_REASONS.map((value) => (
              <label key={value} className="flex items-center gap-2 text-[0.8125rem]">
                <input
                  type="radio"
                  name="reprint-reason"
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                  className="accent-brand size-3.5"
                />
                {REPRINT_REASON_LABELS[value]} —{" "}
                {value === "PRINT_DEFECT" ? S.notCounted : S.counted}
              </label>
            ))}
          </fieldset>
        )}
        <MediaPicker files={files} onChange={setFiles} disabled={busy} />
        {mode !== "add" && (
          <FormField id="sample-sent-on" label={S.physicalOptional}>
            <DatePicker
              id="sample-sent-on"
              value={sentOn}
              onChange={setSentOn}
              max={todayIso()}
              clearable
            />
          </FormField>
        )}
        {mode !== "add" && willExceedFreeRounds(view, counts) && (
          <Alert tone="warning">{S.willExceed}</Alert>
        )}
      </FormDialogBody>
    </FormDialog>
  );
}
