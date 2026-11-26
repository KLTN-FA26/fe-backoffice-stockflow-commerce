"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { EINVOICE_ROUTES } from "@/constants/einvoice";
import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { formatDate } from "@/lib/format/date";
import { useDeliveredShipmentsOfOrder } from "@/lib/references/order-shipments";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { FormSelect } from "@/components/shared/FormSelect";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { applyEInvoiceFieldErrors, einvoiceErrorMessage } from "../errors";
import { drawUpInputSchema } from "../input-schemas";
import { useDrawUpEInvoice } from "../mutations";

import type { z } from "zod";

type Values = z.input<typeof drawUpInputSchema>;
const DRAW_UP_FIELDS = ["shipmentId"] as const;
const D = EINVOICE_LABELS.drawUp;
/** Radix Select không nhận giá trị rỗng → "phần phí còn lại" (không gắn lô giao) dùng giá trị riêng. */
const REMAINDER_VALUE = "__remainder__";

function DrawUpForm({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const drawUp = useDrawUpEInvoice();
  const shipments = useDeliveredShipmentsOfOrder(orderId);
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
        // BO-10: lỗi từng ô của BE hiện dưới ô đó
        onError: (failure) => {
          const mapped = applyEInvoiceFieldErrors(failure, DRAW_UP_FIELDS, (field, message) =>
            form.setError(field, { type: "server", message }),
          );
          if (!mapped) setError(einvoiceErrorMessage(failure));
        },
      },
    ),
  );

  return (
    <FormDialogBody
      title={D.title}
      description={D.description}
      submitLabel={D.submit}
      canSubmit
      isPending={drawUp.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <FormField
        id="drawup-shipment"
        label={D.shipmentLabel}
        error={form.formState.errors.shipmentId?.message}
        hint={shipments.isPending ? undefined : D.shipmentHint}
      >
        <Controller
          control={form.control}
          name="shipmentId"
          render={({ field }) => (
            <FormSelect
              value={field.value ? field.value : REMAINDER_VALUE}
              onValueChange={(value) => field.onChange(value === REMAINDER_VALUE ? "" : value)}
            >
              <SelectTrigger id="drawup-shipment" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={REMAINDER_VALUE}>{D.remainderOption}</SelectItem>
                {(shipments.data ?? []).map((shipment) => (
                  <SelectItem key={shipment.shipmentId} value={shipment.shipmentId}>
                    {shipment.code}
                    {shipment.outcomeAt
                      ? ` · ${D.deliveredOn(formatDate(shipment.outcomeAt))}`
                      : ""}
                    {shipment.packageCount ? ` · ${D.cartons(shipment.packageCount)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </FormSelect>
          )}
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
