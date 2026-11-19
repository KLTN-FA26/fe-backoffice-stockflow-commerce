"use client";

import { useState } from "react";

import { formatMoney } from "@/lib/format/money";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField } from "@/components/shared/FormField";

import { chatErrorMessage, useSendTransferDetails } from "../mutations";

import type { ChatCustomerOverview } from "../schemas";

/**
 * Thẻ thông tin chuyển khoản (S18, 16 BR-06 — cách duy nhất số tài khoản tới khách): chọn một đợt chưa trả,
 * tuỳ chọn "nhắc công nợ" (PAYMENT_REMINDER).
 */
export function TransferDetailsDialog({
  conversationId,
  installments,
  open,
  onOpenChange,
}: {
  conversationId: string;
  installments: ChatCustomerOverview["installments"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const send = useSendTransferDetails();
  const [installmentId, setInstallmentId] = useState("");
  const [reminder, setReminder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setError(null);
    onOpenChange(false);
  };
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <FormDialogBody
          title="Gửi thông tin chuyển khoản"
          description="Hệ thống đăng thẻ có ngân hàng, số tài khoản, số tiền còn phải trả và nội dung chuyển khoản."
          submitLabel="Gửi thẻ"
          canSubmit={!!installmentId}
          isPending={send.isPending}
          error={error}
          onCancel={close}
          onSubmit={() =>
            send.mutate(
              { id: conversationId, installmentId, reminder },
              { onSuccess: close, onError: (failure) => setError(chatErrorMessage(failure)) },
            )
          }
        >
          <FormField id="transfer-installment" label="Đợt thanh toán" required>
            <select
              id="transfer-installment"
              value={installmentId}
              onChange={(event) => setInstallmentId(event.target.value)}
              className={`${FORM_INPUT_CLASS} border px-2`}
            >
              <option value="">Chọn đợt</option>
              {installments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.contractNumber ?? item.orderNumber} — đợt {item.seq} {item.name}:{" "}
                  {formatMoney(item.amount - item.paidAmount, item.currency)}
                </option>
              ))}
            </select>
          </FormField>
          <label className="text-ink-primary flex items-center gap-2 text-[0.8125rem]">
            <input
              type="checkbox"
              checked={reminder}
              onChange={(event) => setReminder(event.target.checked)}
            />
            Nhắc công nợ
          </label>
        </FormDialogBody>
      )}
    </FormDialog>
  );
}
