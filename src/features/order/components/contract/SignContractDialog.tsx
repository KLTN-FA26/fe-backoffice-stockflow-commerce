"use client";

import { useState } from "react";

import { fileTooLargeMessage, uploadFileMaxBytes } from "@/constants/upload-limits";
import { toLocalIsoDate } from "@/lib/format/date";
import { Notice } from "@/components/shared/Notice";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FilePickerField } from "@/components/shared/FilePickerField";
import { DatePicker } from "@/components/shared/DatePicker";
import { FormField, fieldA11y } from "@/components/shared/FormField";

import { contractErrorMessage, useSignSalesContract } from "../../sales-contract-mutations";
import {
  isSignedFileTypeAllowed,
  passedBatches,
  passedBatchesText,
  SIGNED_FILE_ACCEPT,
  SIGNED_FILE_TYPE_MESSAGE,
} from "../../sales-contract-rules";

import { ChatFilePicker } from "./ChatFilePicker";

import type { SalesContract } from "../../sales-contract-schemas";

/**
 * Ghi nhận đã ký (`POST …/contract/signature`, multipart `file` + `version` + `signedOn`): đúng 1 file scan,
 * ngày ký không sau hôm nay, không trước ngày gửi. Idempotency-Key giữ nguyên trong một lần mở hộp thoại.
 */
export function SignContractDialog({
  contract,
  open,
  onOpenChange,
  onSigned,
}: {
  contract: SalesContract;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSigned: () => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <SignForm contract={contract} onClose={() => onOpenChange(false)} onSigned={onSigned} />
      )}
    </FormDialog>
  );
}

function SignForm({
  contract,
  onClose,
  onSigned,
}: {
  contract: SalesContract;
  onClose: () => void;
  onSigned: () => void;
}) {
  const sign = useSignSalesContract();
  // Ngày theo giờ Việt Nam (BE BusinessCalendar).
  const today = toLocalIsoDate(new Date().toISOString());
  const sentOn = contract.sentAt ? toLocalIsoDate(contract.sentAt) : undefined;
  const [file, setFile] = useState<File | null>(null);
  const [signedOn, setSignedOn] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const dateError =
    signedOn > today
      ? "Ngày ký không được sau hôm nay"
      : sentOn && signedOn < sentOn
        ? "Ngày ký không được trước ngày gửi"
        : undefined;
  // BE lưu bản scan vào FileCategory.DOCUMENT (25 MB) — chặn trước khi tải lên thay vì chờ 413.
  const fileError =
    file && !isSignedFileTypeAllowed(file)
      ? SIGNED_FILE_TYPE_MESSAGE
      : file && file.size > uploadFileMaxBytes("signedContract")
        ? fileTooLargeMessage("signedContract")
        : undefined;
  // Mục 10: warn only — a passed window is fixed after signing with "Dời cửa sổ giao".
  const passedText = passedBatchesText(passedBatches(contract, today));

  return (
    <FormDialogBody
      title={`Ghi nhận đã ký ${contract.contractNumber}`}
      description="Tải hợp đồng đã có chữ ký của cả hai bên (PDF, Word, Excel hoặc ảnh JPG/PNG, 1 file, tối đa 25 MB). Kết quả kiểm tra chữ ký sẽ hiện trong mục Chữ ký."
      submitLabel="Ghi nhận đã ký"
      canSubmit={!!file && !fileError && !!signedOn && !dateError}
      isPending={sign.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => {
        if (!file) return;
        setError(null);
        sign.mutate(
          { orderId: contract.orderId, version: contract.version, signedOn, file, idempotencyKey },
          {
            onSuccess: () => {
              onSigned();
              onClose();
            },
            onError: (failure) => setError(contractErrorMessage(failure)),
          },
        );
      }}
    >
      {passedText && <Notice tone="warning">{passedText}</Notice>}
      <FormField id="sign-file" label="File đã ký" required error={fileError}>
        <FilePickerField
          accept={SIGNED_FILE_ACCEPT}
          fileName={file?.name}
          onChange={setFile}
          {...fieldA11y("sign-file", fileError)}
        />
      </FormField>
      <ChatFilePicker contract={contract} current={file} onPick={setFile} />
      <FormField id="sign-date" label="Ngày ký" required error={dateError}>
        <DatePicker
          value={signedOn}
          max={today}
          min={sentOn}
          onChange={setSignedOn}
          {...fieldA11y("sign-date", dateError)}
        />
      </FormField>
    </FormDialogBody>
  );
}
