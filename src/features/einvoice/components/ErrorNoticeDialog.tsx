"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { EINVOICE_LIMITS } from "@/constants/einvoice";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { einvoiceErrorMessage } from "../errors";
import { errorNoticeInputSchema } from "../input-schemas";
import { useRecordErrorNotice } from "../mutations";

import type { EInvoice, ErrorNoticeFormValues, ErrorNoticeInput } from "../types";

const L = EINVOICE_LIMITS;

function ErrorNoticeForm({ invoice, onClose }: { invoice: EInvoice; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const record = useRecordErrorNotice();
  const form = useForm<ErrorNoticeFormValues, unknown, ErrorNoticeInput>({
    resolver: zodResolver(errorNoticeInputSchema),
    defaultValues: { reason: "", correctBuyerName: "", correctBuyerAddress: "" },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((values) =>
    record.mutate(
      { id: invoice.id, ...values },
      { onSuccess: onClose, onError: (failure) => setError(einvoiceErrorMessage(failure)) },
    ),
  );

  return (
    <FormDialogBody
      title={`Thông báo sai sót — ${invoice.code}`}
      description="Mẫu 04/SS-HDDT gửi cơ quan thuế khi hoá đơn sai TÊN hoặc ĐỊA CHỈ bên mua mà mã số thuế đúng (TT 91/2026 Điều 10 khoản 1 điểm a). Không lập hoá đơn mới, hoá đơn giữ nguyên. Sai mã số thuế, số lượng hay số tiền thì lập điều chỉnh / thay thế."
      submitLabel="Gửi thông báo"
      canSubmit
      isPending={record.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <FormField id="notice-reason" label="Sai sót" required error={errors.reason?.message}>
        <Textarea
          autoFocus
          rows={2}
          maxLength={L.reasonMax}
          className={FORM_TEXTAREA_CLASS}
          {...fieldA11y("notice-reason", errors.reason?.message)}
          {...form.register("reason")}
        />
      </FormField>
      <FormField
        id="notice-name"
        label="Tên đúng của bên mua"
        error={errors.correctBuyerName?.message}
      >
        <Input
          maxLength={L.buyerNameMax}
          placeholder={invoice.buyer?.name ?? ""}
          {...fieldA11y("notice-name", errors.correctBuyerName?.message)}
          {...form.register("correctBuyerName")}
        />
      </FormField>
      <FormField
        id="notice-address"
        label="Địa chỉ đúng của bên mua"
        error={errors.correctBuyerAddress?.message}
      >
        <Input
          maxLength={L.buyerAddressMax}
          placeholder={invoice.buyer?.address ?? ""}
          {...fieldA11y("notice-address", errors.correctBuyerAddress?.message)}
          {...form.register("correctBuyerAddress")}
        />
      </FormField>
    </FormDialogBody>
  );
}

/** Lập và gửi thông báo sai sót 04/SS-HDDT (BE `POST /einvoices/{id}/error-notices`). */
export function ErrorNoticeDialog({
  invoice,
  onClose,
}: {
  invoice: EInvoice | null;
  onClose: () => void;
}) {
  return (
    <FormDialog open={invoice !== null} onOpenChange={(open) => !open && onClose()}>
      {invoice && <ErrorNoticeForm invoice={invoice} onClose={onClose} />}
    </FormDialog>
  );
}
