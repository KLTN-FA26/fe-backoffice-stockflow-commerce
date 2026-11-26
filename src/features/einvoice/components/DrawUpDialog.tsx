"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PAGE_SIZE } from "@/constants";
import { EINVOICE_ROUTES } from "@/constants/einvoice";
import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { FormSelect } from "@/components/shared/FormSelect";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { applyEInvoiceFieldErrors, einvoiceErrorMessage } from "../errors";
import { drawUpInputSchema } from "../input-schemas";
import { useDrawUpEInvoice } from "../mutations";
import { useEInvoices } from "../queries";
import { einvoiceStatusLabel } from "../selectors";

import type { z } from "zod";
import type { EInvoiceListItem } from "../types";

type Values = z.input<typeof drawUpInputSchema>;
const DRAW_UP_FIELDS = ["shipmentId"] as const;
const D = EINVOICE_LABELS.drawUp;
/** Radix Select không nhận giá trị rỗng → "phần phí còn lại" (không gắn lô giao) dùng giá trị riêng. */
const REMAINDER_VALUE = "__remainder__";

/** Mỗi lô giao một dòng, theo hoá đơn gốc của lô (không có thì hoá đơn mới nhất), mã lô tăng dần. */
function shipmentChoices(items: readonly EInvoiceListItem[]) {
  const byShipment = new Map<string, EInvoiceListItem>();
  for (const item of items) {
    if (!item.shipmentId) continue;
    const known = byShipment.get(item.shipmentId);
    if (!known || (item.type === "ORIGINAL" && known.type !== "ORIGINAL")) {
      byShipment.set(item.shipmentId, item);
    }
  }
  return [...byShipment.values()]
    .map((item) => ({
      shipmentId: item.shipmentId ?? "",
      code: item.shipmentCode ?? item.shipmentId ?? "",
      statusLabel: einvoiceStatusLabel(item.status),
    }))
    .sort((a, b) => a.code.localeCompare(b.code, "vi", { numeric: true }));
}

function DrawUpForm({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const drawUp = useDrawUpEInvoice();
  // Lô giao lấy từ chính các hoá đơn của đơn (Kế toán không có quyền đọc lô giao): mỗi lô giao thành công đều có hoá đơn
  // gốc (docs 21 BR-01), kể cả bản đã huỷ — đó là các lô lập lại được.
  const invoices = useEInvoices({ orderId, size: PAGE_SIZE.masterData });
  const shipments = shipmentChoices(invoices.data?.items ?? []);
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
        hint={invoices.isPending ? undefined : D.shipmentHint}
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
                {shipments.map((shipment) => (
                  <SelectItem key={shipment.shipmentId} value={shipment.shipmentId}>
                    {shipment.code} · {D.invoiceState(shipment.statusLabel)}
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
