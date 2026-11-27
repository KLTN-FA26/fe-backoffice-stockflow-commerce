"use client";

import { useState } from "react";

import { PRODUCTION_LABELS } from "@/constants";
import { todayIso } from "@/lib/date-range";

import { productionOrderErrorMessage } from "@/features/production-order/errors";
import { useAddSampleMedia, useOpenSampleRound } from "@/features/production-order/sample-hooks";
import { sampleFileProblems } from "@/features/production-order/sample-files";
import { willExceedFreeRounds } from "@/features/production-order/sample-lifecycle";
import { openRoundInput } from "@/features/production-order/sample-schemas";

import { Alert } from "@/components/shared/Alert";
import { DatePicker } from "@/components/shared/DatePicker";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";

import { MediaPicker } from "./MediaPicker";
import { ReprintReasonField } from "./ReprintReasonField";
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
  const { uploadAll, settleFailure, progress } = useSampleUpload(view.productionOrderId);
  const [files, setFiles] = useState<File[]>([]);
  const [reason, setReason] = useState<ReprintReason | null>(null);
  const [sentOn, setSentOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busy = progress !== null || open.isPending || add.isPending;
  const counts = mode === "first" || reason === "CUSTOMER_CHANGE";
  // BR-24: vòng in lại bắt buộc lý do; ngày gửi mẫu vật không sau hôm nay. Thêm tệp chỉ khi còn vòng đang chờ.
  const round = openRoundInput(mode === "reprint").safeParse({
    reprintReason: reason,
    physicalSampleSentOn: sentOn,
  });
  const sentOnError = round.error?.issues.find((i) => i.path[0] === "physicalSampleSentOn");
  const fileProblems = sampleFileProblems(files).length > 0;
  const valid =
    files.length > 0 && !fileProblems && (mode === "add" ? roundId !== undefined : round.success);
  // Vì sao nút đang khoá — một dòng ngay dưới các ô, không chỉ nút xám
  const missing =
    files.length === 0
      ? S.missingFile
      : fileProblems
        ? S.fixFiles
        : mode === "reprint" && !reason
          ? S.missingReason
          : null;

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
      onError: (failure: unknown) => {
        settleFailure(failure);
        setError(productionOrderErrorMessage(failure));
      },
    };
    if (mode === "add") {
      if (roundId) add.mutate({ orderId: view.productionOrderId, roundId, uploadIds }, handlers);
    } else
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
        {mode === "reprint" && <ReprintReasonField value={reason} onChange={setReason} />}
        <MediaPicker files={files} onChange={setFiles} disabled={busy} />
        {mode !== "add" && (
          <FormField id="sample-sent-on" label={S.physicalOptional} error={sentOnError?.message}>
            <DatePicker
              id="sample-sent-on"
              value={sentOn}
              onChange={setSentOn}
              max={todayIso()}
              clearable
            />
          </FormField>
        )}
        {missing && (
          <p role="status" className="text-ink-secondary text-xs">
            {missing}
          </p>
        )}
        {mode !== "add" && willExceedFreeRounds(view, counts) && (
          <Alert tone="warning">{S.willExceed}</Alert>
        )}
      </FormDialogBody>
    </FormDialog>
  );
}
