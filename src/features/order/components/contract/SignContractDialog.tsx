"use client";

import { useState } from "react";

import { toLocalIsoDate } from "@/lib/format/date";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";

import { contractErrorMessage, useSignSalesContract } from "../../sales-contract-mutations";

import type { SalesContract } from "../../sales-contract-schemas";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

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

  return (
    <FormDialogBody
      title={`Ghi nhận đã ký ${contract.contractNumber}`}
      description="Tải bản scan hợp đồng có chữ ký của khách (PDF hoặc ảnh, 1 file)."
      submitLabel="Ghi nhận đã ký"
      canSubmit={!!file && !!signedOn && !dateError}
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
      <FormField id="sign-file" label="File đã ký" required>
        <Input
          id="sign-file"
          type="file"
          accept={ACCEPT}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className={FORM_INPUT_CLASS}
        />
      </FormField>
      <FormField id="sign-date" label="Ngày ký" required error={dateError}>
        <Input
          type="date"
          value={signedOn}
          max={today}
          min={sentOn}
          onChange={(event) => setSignedOn(event.target.value)}
          {...fieldA11y("sign-date", dateError)}
          className={FORM_INPUT_CLASS}
        />
      </FormField>
    </FormDialogBody>
  );
}
