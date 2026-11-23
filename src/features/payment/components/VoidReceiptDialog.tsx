"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_LIMITS } from "@/constants/payment";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { receiptErrorMessage } from "../errors";
import { useVoidReceipt } from "../mutations";
import { voidInputSchema } from "../input-schemas";

import type { PaymentReceipt, VoidFormValues, VoidInput } from "../types";

/** Các đơn có tiền trong phiếu (theo dòng phiếu), kèm có đợt khi ký hay không. */
function receiptOrders(receipt: PaymentReceipt): { orderNumber: string; onSigning: boolean }[] {
  const byOrder = new Map<string, boolean>();
  for (const line of receipt.lines) {
    if (!line.orderNumber) continue;
    byOrder.set(
      line.orderNumber,
      (byOrder.get(line.orderNumber) ?? false) || line.milestone === "ON_SIGNING",
    );
  }
  return [...byOrder].map(([orderNumber, onSigning]) => ({ orderNumber, onSigning }));
}

const L = PAYMENT_LABELS.voidDialog;

function VoidReceiptForm({ receipt, onClose }: { receipt: PaymentReceipt; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const voidReceipt = useVoidReceipt();
  const form = useForm<VoidFormValues, unknown, VoidInput>({
    resolver: zodResolver(voidInputSchema),
    defaultValues: { reason: "", holdOrders: false },
  });
  const { errors } = form.formState;
  const orders = receiptOrders(receipt);
  // Chỉ đợt khi ký làm đơn đã xác nhận quay lại thiếu tiền (15 BR-13): đó là các đơn có thể bị treo.
  const heldOrders = orders.filter((order) => order.onSigning).map((order) => order.orderNumber);
  const submit = form.handleSubmit((values) =>
    voidReceipt.mutate(
      { id: receipt.receiptId, ...values },
      { onSuccess: onClose, onError: (failure) => setError(receiptErrorMessage(failure)) },
    ),
  );

  return (
    <FormDialogBody
      title={`${L.title} ${receipt.reference}`}
      description={L.description}
      submitLabel={L.submit}
      danger
      canSubmit
      isPending={voidReceipt.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      {orders.length > 0 && (
        // BO-UX-40: các đơn có tiền trong phiếu — biết trước đơn nào có thể bị treo, không đợi BE từ chối.
        <div className="text-[0.8125rem]">
          <p className="text-ink-secondary text-xs font-medium">{L.ordersTitle}</p>
          <ul className="text-ink-primary mt-1 space-y-0.5">
            {orders.map((order) => (
              <li key={order.orderNumber}>
                <span className="font-mono">{order.orderNumber}</span>
                {order.onSigning && (
                  <span className="text-ink-secondary"> · có đợt thanh toán khi ký</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <FormField id="void-reason" label={L.reason} required error={errors.reason?.message}>
        <Textarea
          autoFocus
          rows={3}
          maxLength={PAYMENT_LIMITS.reasonMax}
          className={FORM_TEXTAREA_CLASS}
          {...fieldA11y("void-reason", errors.reason?.message)}
          {...form.register("reason")}
        />
      </FormField>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Controller
            control={form.control}
            name="holdOrders"
            render={({ field }) => (
              <Checkbox
                id="void-hold-orders"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            )}
          />
          <Label htmlFor="void-hold-orders" className="text-[0.8125rem]">
            {heldOrders.length > 0 ? L.holdOrdersFor(heldOrders.join(", ")) : L.holdOrders}
          </Label>
        </div>
        <p className="text-ink-secondary text-xs">{L.holdHint}</p>
      </div>
    </FormDialogBody>
  );
}

/**
 * Huỷ phiếu thu ghi sai (docs 15 §4.4): bắt buộc lý do; phiếu giữ nguyên nội dung, đợt được tính lại.
 * "Treo đơn" tương ứng `holdOrders` — thiếu thì BE từ chối khi huỷ làm đơn đã xác nhận thiếu đợt khi ký (BR-13).
 */
export function VoidReceiptDialog({
  receipt,
  onClose,
}: {
  receipt: PaymentReceipt | null;
  onClose: () => void;
}) {
  return (
    <FormDialog open={receipt !== null} onOpenChange={(open) => !open && onClose()}>
      {receipt && <VoidReceiptForm receipt={receipt} onClose={onClose} />}
    </FormDialog>
  );
}
