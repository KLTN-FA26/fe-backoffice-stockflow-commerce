"use client";

import { Lock, Paperclip } from "lucide-react";

import { CHAT_MENTION_LABELS } from "@/constants";

import { openLink } from "@/lib/files/open-blob";
import { formatDateTime } from "@/lib/format/date";
import { toast } from "@/components/shared/Toast";

import { attachmentLink } from "../api";
import { chatErrorMessage } from "../mutations";
import { isInternalNote } from "../selectors";

import { AttachmentPreview, isImageAttachment } from "./AttachmentPreview";
import { ChatCardView } from "./ChatCardView";

import type { QuoteGate } from "./ChatCardView";

import type { ChatMessage } from "../schemas";

/** Một tin: khách (trái), Sale / hệ thống (phải), ghi chú nội bộ nền vàng + "Khách không thấy" (16 BR-07). */
export function MessageItem({
  message,
  quoteGate,
}: {
  message: ChatMessage;
  quoteGate: QuoteGate;
}) {
  const note = isInternalNote(message);
  const mine = message.senderType !== "CUSTOMER";
  const download = async (attachmentId: string) => {
    try {
      openLink((await attachmentLink(message.conversationId, attachmentId)).url);
    } catch (error) {
      toast.error(chatErrorMessage(error));
    }
  };
  return (
    <li className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] space-y-1 rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem] ${
          note
            ? "border-warning/40 bg-warning/10"
            : mine
              ? "border-border-default bg-bg-subtle"
              : "border-border-default bg-bg-surface"
        }`}
      >
        <div className="text-ink-tertiary flex items-center gap-2 text-xs">
          <span>{message.senderName ?? (message.senderType === "SYSTEM" ? "Hệ thống" : "")}</span>
          <span className="tabular-nums">{formatDateTime(message.sentAt)}</span>
          {note && (
            <span className="text-warning-ink inline-flex items-center gap-1 font-medium">
              <Lock className="size-3" /> Ghi chú nội bộ — Khách không thấy
            </span>
          )}
        </div>
        {message.deleted ? (
          <p className="text-ink-tertiary italic">Tin đã bị xoá</p>
        ) : (
          <>
            {message.card ? (
              <ChatCardView message={message} quoteGate={quoteGate} />
            ) : (
              message.body && <p className="text-ink-primary whitespace-pre-line">{message.body}</p>
            )}
            {note && message.mentions.length > 0 && (
              <p className="text-ink-secondary text-xs">
                {CHAT_MENTION_LABELS.mentionedCount(message.mentions.length)}
              </p>
            )}
            {message.attachments.map((file) => (
              <div key={file.id} className="space-y-1">
                {isImageAttachment(file) && (
                  <AttachmentPreview conversationId={message.conversationId} file={file} />
                )}
                <button
                  type="button"
                  className="text-accent-text inline-flex items-center gap-1 hover:underline"
                  onClick={() => void download(file.id)}
                >
                  <Paperclip className="size-3.5" /> {file.fileName}
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </li>
  );
}
