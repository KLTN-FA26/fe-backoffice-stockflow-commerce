"use client";

import { Lock, Paperclip } from "lucide-react";

import { openLink } from "@/lib/files/open-blob";
import { formatDateTime } from "@/lib/format/date";
import { toast } from "@/components/shared/Toast";

import { attachmentLink } from "../api";
import { chatErrorMessage } from "../mutations";
import { isInternalNote } from "../selectors";

import { ChatCardView } from "./ChatCardView";

import type { ChatMessage } from "../schemas";

/** Một tin: khách (trái), Sale / hệ thống (phải), ghi chú nội bộ nền vàng + "Khách không thấy" (16 BR-07). */
export function MessageItem({ message }: { message: ChatMessage }) {
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
            <span className="text-warning inline-flex items-center gap-1 font-medium">
              <Lock className="size-3" /> Ghi chú nội bộ — Khách không thấy
            </span>
          )}
        </div>
        {message.deleted ? (
          <p className="text-ink-tertiary italic">Tin đã bị xoá</p>
        ) : (
          <>
            {message.card ? (
              <ChatCardView message={message} />
            ) : (
              message.body && <p className="text-ink-primary whitespace-pre-line">{message.body}</p>
            )}
            {message.attachments.map((file) => (
              <button
                key={file.id}
                type="button"
                className="text-accent inline-flex items-center gap-1 hover:underline"
                onClick={() => void download(file.id)}
              >
                <Paperclip className="size-3.5" /> {file.fileName}
              </button>
            ))}
          </>
        )}
      </div>
    </li>
  );
}
