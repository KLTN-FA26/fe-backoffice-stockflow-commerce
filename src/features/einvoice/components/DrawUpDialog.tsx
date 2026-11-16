"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { EINVOICE_ROUTES } from "@/constants/einvoice";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";

import { einvoiceErrorMessage } from "../errors";
import { drawUpInputSchema } from "../input-schemas";
import { useDrawUpEInvoice } from "../mutations";

import type { z } from "zod";

type Values = z.input<typeof drawUpInputSchema>;

function DrawUpForm({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const drawUp = useDrawUpEInvoice();
  const form = useForm<Values>({
    resolver: zodResolver(drawUpInputSchema),
    defaultValues: { orderId, shipmentId: "" },
  });
  const submit = form.handleSubmit((values) =>
    drawUp.mutate(
      { orderId: values.orderId, shipmentId: values.shipmentId?.trim() || undefined },
      {
        onSuccess: (invoice) => {
          onClose();
          router.push(EINVOICE_ROUTES.detail(invoice.id));
        },
        onError: (failure) => setError(einvoiceErrorMessage(failure)),
      },
    ),
  );

  return (
    <FormDialogBody
      title="Lập hoá đơn nháp"
      description="Lập lại nháp cho một lần giao đã giao thành công mà nháp đã bị huỷ, hoặc để trống mã lần giao để lập hoá đơn cho phần phí vận chuyển còn lại sau khi đóng phần chưa giao (docs 21 §4.1, §4.5)."
      submitLabel="Lập nháp"
      canSubmit
      isPending={drawUp.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <FormField id="drawup-shipment" label="Mã lần giao (shipment ID)">
        <Input
          autoFocus
          placeholder="Để trống = phần phí vận chuyển còn lại"
          {...fieldA11y("drawup-shipment", undefined)}
          {...form.register("shipmentId")}
        />
      </FormField>
    </FormDialogBody>
  );
}

/** Lập nháp thủ công cho một đơn (BE `POST /einvoices`); trả về nháp đang hiệu lực nếu đã có. */
export function DrawUpDialog({
  orderId,
  onClose,
}: {
  orderId: string | null;
  onClose: () => void;
}) {
  return (
    <FormDialog open={orderId !== null} onOpenChange={(open) => !open && onClose()}>
      {orderId && <DrawUpForm orderId={orderId} onClose={onClose} />}
    </FormDialog>
  );
}
