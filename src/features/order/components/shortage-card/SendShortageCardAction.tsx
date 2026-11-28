"use client";

import { useState } from "react";
import { Send } from "lucide-react";

import { SHORTAGE_LABELS, SHORTAGE_NOT_SENDABLE_LABELS, SHORTAGE_NOTE_MAX } from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";

import { SHORTAGE_SEND_STALE_CODES, shortageSendErrorView } from "../../shortage-card-errors";
import { canSendShortageCard } from "../../shortage-card-lifecycle";
import { useSendShortageCard } from "../../shortage-card-mutations";
import { NoteField } from "../ReasonDialogFields";
import { useOrderActionDialog } from "../useOrderActionDialog";

import type { PermissionCode } from "@/lib/auth";
import type { ShortagePreview } from "../../shortage-card-schemas";
import type { Order } from "../../types";

const L = SHORTAGE_LABELS;
const ACTION = { toView: shortageSendErrorView, staleCodes: SHORTAGE_SEND_STALE_CODES };
/** Gửi được khi đơn đủ điều kiện, hoặc đã có thẻ chờ khách chọn (gửi thẻ mới thay thẻ cũ, `replaceLive`). */
const canSendNow = (preview: ShortagePreview) =>
  preview.sendable || preview.notSendable === "LIVE_CARD";

/**
 * "Gửi thẻ thiếu thùng" (docs 17 §4.14 bước 55–56, 16 BR-15): hệ thống lập thẻ từ đơn, Sale chỉ gõ lời nhắn. Không gửi
 * được thì nút khoá và NÓI vì sao (không ẩn). Đã có thẻ đang chờ → hộp thoại hỏi gửi thẻ mới thay thẻ cũ.
 * UI-only — Backend phải re-check (`chat-conversations:UPDATE`, người được giao hội thoại, SHORTAGE_CARD_NOT_SENDABLE).
 */
export function SendShortageCardAction({
  order,
  preview,
  can,
}: {
  order: Pick<Order, "orderId" | "customerId">;
  preview: ShortagePreview;
  can: (code: PermissionCode) => boolean;
}) {
  const dialog = useOrderActionDialog(ACTION);
  const { mutate, isPending } = useSendShortageCard(dialog.hookOptions);
  const [note, setNote] = useState("");
  const replace = preview.notSendable === "LIVE_CARD";
  const allowed = canSendShortageCard(can);
  const enabled = allowed && canSendNow(preview);
  const hint = !allowed
    ? L.blockedNoPermission
    : preview.sendable
      ? null
      : (SHORTAGE_NOT_SENDABLE_LABELS[preview.notSendable ?? ""] ?? null);
  const D = L.sendDialog;

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        disabled={!enabled}
        onClick={() => {
          setNote("");
          dialog.show();
        }}
      >
        <Send className="size-3.5" aria-hidden="true" /> {L.send}
      </Button>
      {hint && <p className="text-ink-secondary text-xs">{hint}</p>}
      {dialog.open && (
        <FormDialog open onOpenChange={(open) => !open && !isPending && dialog.close()}>
          <FormDialogBody
            title={replace ? D.replaceTitle : D.title}
            description={replace ? D.replaceDescription : D.description}
            submitLabel={replace ? D.replaceConfirm : D.submit}
            canSubmit
            isPending={isPending}
            error={dialog.error}
            onCancel={dialog.close}
            onSubmit={() =>
              dialog.submit(mutate, {
                orderId: order.orderId,
                customerId: order.customerId,
                note: note.trim(),
                replaceLive: replace,
              })
            }
          >
            <NoteField
              label={D.noteLabel}
              placeholder={D.notePlaceholder}
              value={note}
              max={SHORTAGE_NOTE_MAX.card}
              required={false}
              autoFocus
              hint={null}
              error={undefined}
              onChange={setNote}
            />
          </FormDialogBody>
        </FormDialog>
      )}
    </div>
  );
}
