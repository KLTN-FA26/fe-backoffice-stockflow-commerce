"use client";

import { useState } from "react";

import { EINVOICE_LIMITS } from "@/constants/einvoice";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { DatePicker } from "@/components/shared/DatePicker";
import { Input } from "@/components/ui/input";

import { einvoiceErrorMessage } from "../errors";
import { agreementInputSchema } from "../input-schemas";
import { useAttachAgreement } from "../mutations";

import type { EInvoice } from "../types";

function AgreementForm({ invoice, onClose }: { invoice: EInvoice; onClose: () => void }) {
  const [number, setNumber] = useState(invoice.agreement?.number ?? "");
  const [date, setDate] = useState(invoice.agreement?.date ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attach = useAttachAgreement();
  const submit = () => {
    const parsed = agreementInputSchema.safeParse({ number, date, file });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ");
      return;
    }
    setError(null);
    attach.mutate(
      { id: invoice.id, version: invoice.version, ...parsed.data },
      { onSuccess: onClose, onError: (failure) => setError(einvoiceErrorMessage(failure)) },
    );
  };
  return (
    <FormDialogBody
      title="Gắn văn bản thoả thuận"
      description="Điều chỉnh / thay thế vì sai sót cần văn bản thoả thuận với bên mua (tệp PDF đã ký, số, ngày) trước khi phát hành (TT 91/2026 Điều 10). Gắn lại sẽ thay văn bản cũ."
      submitLabel="Gắn văn bản"
      canSubmit
      isPending={attach.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={submit}
    >
      <FormField id="agreement-number" label="Số văn bản" required>
        <Input
          id="agreement-number"
          autoFocus
          maxLength={EINVOICE_LIMITS.agreementNumberMax}
          value={number}
          onChange={(event) => setNumber(event.target.value)}
        />
      </FormField>
      <FormField id="agreement-date" label="Ngày ký" required>
        <DatePicker id="agreement-date" value={date} onChange={setDate} />
      </FormField>
      <FormField id="agreement-file" label="Tệp PDF đã ký" required>
        <Input
          id="agreement-file"
          type="file"
          accept="application/pdf"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </FormField>
    </FormDialogBody>
  );
}

/** Gắn thoả thuận cho nháp điều chỉnh / thay thế vì sai sót (BE `PUT /einvoices/{id}/agreement`). */
export function AgreementDialog({
  invoice,
  onClose,
}: {
  invoice: EInvoice | null;
  onClose: () => void;
}) {
  return (
    <FormDialog open={invoice !== null} onOpenChange={(open) => !open && onClose()}>
      {invoice && <AgreementForm invoice={invoice} onClose={onClose} />}
    </FormDialog>
  );
}
