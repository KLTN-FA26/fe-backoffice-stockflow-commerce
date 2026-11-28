"use client";

import { useState } from "react";

import {
  SHORTAGE_ERROR_MESSAGES,
  SHORTAGE_LABELS,
  SHORTAGE_NOT_SENDABLE_LABELS,
  SHORTAGE_NOTE_MAX,
} from "@/constants";
import { ApiError } from "@/lib/api/error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { Notice } from "@/components/shared/Notice";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/combobox-select";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";

import { useChatFailure } from "../mutations";
import { useOrderShortageReadiness, useSendShortageCardInChat } from "../shortage-send";

import { attachableDocuments } from "../selectors";

import type { ChatCustomerOverview } from "../schemas";
import type { AttachableDocument } from "../selectors";

const C = SHORTAGE_LABELS.chat;
const D = SHORTAGE_LABELS.sendDialog;

function Readiness({ orderId }: { orderId: string }) {
  const readiness = useOrderShortageReadiness(orderId);
  if (!orderId) return <p className="text-ink-tertiary text-[0.8125rem]">{C.pickFirst}</p>;
  if (readiness.isPending)
    return <p className="text-ink-tertiary text-[0.8125rem]">{C.checking}</p>;
  if (readiness.isError) return <Notice tone="warning">{SHORTAGE_LABELS.loadFailed}</Notice>;
  const { sendable, notSendable } = readiness.data;
  return sendable ? (
    <Notice tone="positive">{C.readyNote}</Notice>
  ) : (
    <Notice tone="warning">
      {SHORTAGE_NOT_SENDABLE_LABELS[notSendable ?? ""] ?? D.replaceDescription}
    </Notice>
  );
}

/**
 * "Gửi thẻ thiếu thùng" từ panel khách (docs 16 §4.7): chọn đơn của khách, xem đơn có gửi được không, thêm lời nhắn. Đã có
 * thẻ đang chờ → gửi thẻ mới thay thẻ cũ. UI-only — Backend phải re-check (`chat-conversations:UPDATE`, người được giao
 * hội thoại, SHORTAGE_CARD_NOT_SENDABLE).
 */
export function ShortageCardDialog({
  conversationId,
  orders,
  open,
  onOpenChange,
}: {
  conversationId: string;
  orders: readonly AttachableDocument[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const send = useSendShortageCardInChat();
  const describeError = useChatFailure();
  const [orderId, setOrderId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const readiness = useOrderShortageReadiness(orderId);
  const replace = readiness.data?.notSendable === "LIVE_CARD";
  const canSend = !!readiness.data && (readiness.data.sendable || replace);
  const close = () => {
    setError(null);
    onOpenChange(false);
  };
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <FormDialogBody
          title={D.title}
          description={D.description}
          submitLabel={replace ? D.replaceConfirm : D.submit}
          canSubmit={canSend}
          isPending={send.isPending}
          error={error}
          onCancel={close}
          onSubmit={() =>
            send.mutate(
              { conversationId, orderId, note: note.trim(), replaceLive: replace },
              {
                onSuccess: close,
                onError: (failure) =>
                  setError(
                    failure instanceof ApiError && failure.code in SHORTAGE_ERROR_MESSAGES
                      ? SHORTAGE_ERROR_MESSAGES[
                          failure.code as keyof typeof SHORTAGE_ERROR_MESSAGES
                        ]
                      : describeError(failure),
                  ),
              },
            )
          }
        >
          <FormField id="shortage-order" label={C.pickOrder} required>
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger id="shortage-order" className={FORM_SELECT_CLASS}>
                <SelectValue placeholder={C.pickPlaceholder} />
              </SelectTrigger>
              <TitledSelectContent title={C.pickOrder}>
                {orders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>
                    {order.label}
                  </SelectItem>
                ))}
              </TitledSelectContent>
            </Select>
          </FormField>
          <Readiness orderId={orderId} />
          <FormField id="shortage-note" label={D.noteLabel}>
            <Textarea
              id="shortage-note"
              rows={3}
              maxLength={SHORTAGE_NOTE_MAX.card}
              value={note}
              placeholder={D.notePlaceholder}
              onChange={(event) => setNote(event.target.value)}
            />
          </FormField>
        </FormDialogBody>
      )}
    </FormDialog>
  );
}

/** Mục "Thiếu thùng" của panel khách: nút mở hộp thoại gửi thẻ, chỉ khi khách có đơn. */
export function ShortageCardPanelAction({
  conversationId,
  overview,
}: {
  conversationId: string;
  overview: ChatCustomerOverview | undefined;
}) {
  const [open, setOpen] = useState(false);
  const orders = attachableDocuments(overview, "ORDER");
  if (orders.length === 0) return null;
  return (
    <div className="space-y-1">
      <h3 className="text-ink-secondary text-xs font-medium">{SHORTAGE_LABELS.section}</h3>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {C.action}
      </Button>
      <ShortageCardDialog
        conversationId={conversationId}
        orders={orders}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
