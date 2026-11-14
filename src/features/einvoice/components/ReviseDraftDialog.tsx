"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { EINVOICE_LIMITS } from "@/constants/einvoice";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";

import { einvoiceErrorMessage } from "../errors";
import { reviseDraftInputSchema } from "../input-schemas";
import { useReviseDraft } from "../mutations";

import type { EInvoice, ReviseDraftFormValues, ReviseDraftInput } from "../types";

const L = EINVOICE_LIMITS;
const FIELDS = [
  { name: "buyerName", label: "Tên bên mua", max: L.buyerNameMax },
  { name: "buyerTaxCode", label: "Mã số thuế", max: L.buyerTaxCodeMax },
  { name: "buyerAddress", label: "Địa chỉ trên hoá đơn", max: L.buyerAddressMax },
  { name: "buyerEmail", label: "Email nhận hoá đơn", max: L.buyerEmailMax },
] as const;

function ReviseForm({ invoice, onClose }: { invoice: EInvoice; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const revise = useReviseDraft();
  const form = useForm<ReviseDraftFormValues, unknown, ReviseDraftInput>({
    resolver: zodResolver(reviseDraftInputSchema),
    defaultValues: {
      buyerName: invoice.buyer?.name ?? "",
      buyerTaxCode: invoice.buyer?.taxCode ?? "",
      buyerAddress: invoice.buyer?.address ?? "",
      buyerEmail: invoice.buyer?.email ?? "",
    },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((values) =>
    revise.mutate(
      { id: invoice.id, version: invoice.version, ...values },
      { onSuccess: onClose, onError: (failure) => setError(einvoiceErrorMessage(failure)) },
    ),
  );

  return (
    <FormDialogBody
      title={`Sửa nháp ${invoice.code}`}
      description="Sửa thông tin bên mua in trên hoá đơn. Số lượng và đơn giá là của hợp đồng, không sửa ở đây. Muốn lấy lại theo hồ sơ khách, dùng “Làm mới bên mua”."
      submitLabel="Lưu nháp"
      canSubmit
      isPending={revise.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      {FIELDS.map((field, index) => (
        <FormField
          key={field.name}
          id={`revise-${field.name}`}
          label={field.label}
          error={errors[field.name]?.message}
        >
          <Input
            autoFocus={index === 0}
            maxLength={field.max}
            {...fieldA11y(`revise-${field.name}`, errors[field.name]?.message)}
            {...form.register(field.name)}
          />
        </FormField>
      ))}
    </FormDialogBody>
  );
}

/** Sửa nháp (BE `PUT /einvoices/{id}`, docs 21 §4.2 bước 4: bổ sung thông tin bên mua). */
export function ReviseDraftDialog({
  invoice,
  onClose,
}: {
  invoice: EInvoice | null;
  onClose: () => void;
}) {
  return (
    <FormDialog open={invoice !== null} onOpenChange={(open) => !open && onClose()}>
      {invoice && <ReviseForm invoice={invoice} onClose={onClose} />}
    </FormDialog>
  );
}
