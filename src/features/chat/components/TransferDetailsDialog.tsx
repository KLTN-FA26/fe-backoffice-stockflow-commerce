"use client";

import { useState } from "react";

import { CHAT_TRANSFER_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format/money";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField } from "@/components/shared/FormField";
import { Notice } from "@/components/shared/Notice";

import { transferViewFromInstructions } from "../card-view";
import { owedOf } from "../lifecycle";
import { useChatFailure, useSendTransferDetails } from "../mutations";
import { useTransferInstructions } from "../queries";

import { TransferDetails } from "./TransferDetails";

import type { ChatCustomerOverview } from "../schemas";

/** Bản xem trước: đúng các trường thẻ sẽ mang (BO-UX-45), đọc từ nguồn BE vẽ thẻ (`transfer-instructions`). */
function TransferPreview({ installmentId }: { installmentId: string }) {
  const preview = useTransferInstructions(installmentId);
  const L = CHAT_TRANSFER_LABELS;
  return (
    <section
      aria-label={L.previewTitle}
      aria-busy={preview.isFetching}
      className="border-border-default bg-bg-subtle space-y-2 rounded-[var(--r-sm)] border p-3 text-[0.8125rem]"
    >
      <h3 className="text-ink-secondary text-xs font-medium">{L.previewTitle}</h3>
      {!installmentId ? (
        <p className="text-ink-tertiary">{L.pickFirst}</p>
      ) : preview.isPending ? (
        <p className="text-ink-tertiary">{L.previewLoading}</p>
      ) : preview.isError ? (
        <Notice tone="warning">{L.previewError}</Notice>
      ) : (
        <TransferDetails
          view={transferViewFromInstructions(preview.data)}
          noQrNote={L.previewNoQr}
        />
      )}
    </section>
  );
}

/**
 * Thẻ thông tin chuyển khoản (S18, 16 BR-06 — cách duy nhất số tài khoản tới khách): chọn một đợt chưa trả, xem trước
 * đúng thẻ khách sẽ nhận (BO-UX-45), tuỳ chọn "nhắc công nợ" (PAYMENT_REMINDER). Số còn phải thu của đợt là
 * `outstanding` của BE (BE-6, đã trừ phần giảm), không phải `amount − paidAmount`.
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
  const describeError = useChatFailure();
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
          description="Kiểm tra thẻ bên dưới trước khi gửi: khách sẽ chuyển khoản theo đúng các thông tin này."
          submitLabel="Gửi thẻ cho khách"
          canSubmit={!!installmentId}
          isPending={send.isPending}
          error={error}
          onCancel={close}
          onSubmit={() =>
            send.mutate(
              { id: conversationId, installmentId, reminder },
              { onSuccess: close, onError: (failure) => setError(describeError(failure)) },
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
                  {formatMoney(owedOf(item), item.currency)}
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
            Nhắc công nợ (gửi dạng thẻ nhắc thanh toán)
          </label>
          <TransferPreview installmentId={installmentId} />
        </FormDialogBody>
      )}
    </FormDialog>
  );
}
