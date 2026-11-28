"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PAGE_SIZE } from "@/constants";
import { EINVOICE_ROUTES } from "@/constants/einvoice";
import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { useDeliveredShipmentsOfOrder } from "@/lib/references/order-delivered-shipments";
import { FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FormSelect } from "@/components/shared/FormSelect";
import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/combobox-select";

import { shipmentChoiceLabel, shipmentChoices } from "../drawup-shipments";
import { applyEInvoiceFieldErrors, einvoiceErrorMessage } from "../errors";
import { drawUpInputSchema } from "../input-schemas";
import { useDrawUpEInvoice } from "../mutations";
import { useEInvoices } from "../queries";

import type { z } from "zod";

type Values = z.input<typeof drawUpInputSchema>;
const DRAW_UP_FIELDS = ["shipmentId"] as const;
const D = EINVOICE_LABELS.drawUp;
/** Radix Select không nhận giá trị rỗng → "phần phí còn lại" (không gắn lô giao) dùng giá trị riêng. */
const REMAINDER_VALUE = "__remainder__";

/** Chọn lô giao (hoặc phần phí còn lại) của một đơn rồi lập nháp (BE `POST /einvoices`). */
export function DrawUpForm({
  orderId,
  orderNumber,
  onChangeOrder,
  onClose,
}: {
  orderId: string;
  /** Có khi người dùng chọn đơn ngay trong hộp: hiện số đơn kèm nút đổi đơn. */
  orderNumber?: string | undefined;
  onChangeOrder?: (() => void) | undefined;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const drawUp = useDrawUpEInvoice();
  // Hai nguồn lô giao (Kế toán không đọc được `/fulfillment/shipments`): hoá đơn của đơn (có mã lô, kể cả nháp đã huỷ) và
  // các lô đã giao của đơn — lô mà nháp tự động bị từ chối thì chưa có hoá đơn nào nhưng vẫn lập tay được.
  const invoices = useEInvoices({ orderId, size: PAGE_SIZE.masterData });
  const delivered = useDeliveredShipmentsOfOrder(orderId);
  const items = invoices.data?.items ?? [];
  const total = invoices.data?.totalElements ?? items.length;
  const choices = shipmentChoices(items, delivered.data ?? []);
  const form = useForm<Values>({
    resolver: zodResolver(drawUpInputSchema),
    defaultValues: { orderId, shipmentId: "" },
  });
  const shipmentError = form.formState.errors.shipmentId?.message;
  const loading = invoices.isPending || delivered.isPending;
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
      {orderNumber && onChangeOrder && (
        <p className="text-ink-secondary flex items-center gap-2 text-[0.8125rem]">
          <span className="text-ink-primary font-medium">{D.orderChosen(orderNumber)}</span>
          <button
            type="button"
            className="text-accent-text hover:underline"
            onClick={onChangeOrder}
          >
            {D.changeOrder}
          </button>
        </p>
      )}
      <FormField
        id="drawup-shipment"
        label={D.shipmentLabel}
        error={shipmentError}
        hint={
          loading ? undefined : (
            <>
              {D.shipmentHint}
              {total > items.length && ` ${D.truncated(items.length, total)}`}
            </>
          )
        }
      >
        <Controller
          control={form.control}
          name="shipmentId"
          render={({ field }) => (
            <FormSelect
              value={field.value ? field.value : REMAINDER_VALUE}
              onValueChange={(value) => field.onChange(value === REMAINDER_VALUE ? "" : value)}
            >
              <SelectTrigger
                {...fieldA11y("drawup-shipment", shipmentError, !loading)}
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={REMAINDER_VALUE}>{D.remainderOption}</SelectItem>
                {choices.map((choice) => (
                  <SelectItem key={choice.shipmentId} value={choice.shipmentId}>
                    {shipmentChoiceLabel(choice, D)}
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
