"use client";

import { useState } from "react";
import { LoaderCircle, Paperclip, Send } from "lucide-react";

import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fileTooLargeMessage, uploadFileMaxBytes } from "@/constants/upload-limits";

import { chatErrorMessage, useSendAttachment, useSendNote, useSendText } from "../mutations";

import { CannedPicker } from "./CannedPicker";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
type Mode = "reply" | "note";

/**
 * Soạn tin: "Trả lời khách" (S5) hoặc "Ghi chú nội bộ" (S6, khách không thấy); kèm file (S7). Mỗi lần gửi một
 * `clientMessageId` mới; bấm lại sau lỗi dùng lại để BE không tạo tin trùng. Câu trả lời mẫu chèn vào ô trả lời
 * khách để sửa trước khi gửi.
 */
export function Composer({
  conversationId,
  canReply,
  canNote,
  canUseCanned = false,
}: {
  conversationId: string;
  canReply: boolean;
  canNote: boolean;
  canUseCanned?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(canReply ? "reply" : "note");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientMessageId, setClientMessageId] = useState(() => crypto.randomUUID());
  const sendText = useSendText();
  const sendNote = useSendNote();
  const sendFile = useSendAttachment();
  const pending = sendText.isPending || sendNote.isPending || sendFile.isPending;
  if (!canReply && !canNote) return null;

  const done = () => {
    setText("");
    setFile(null);
    setError(null);
    setClientMessageId(crypto.randomUUID());
  };
  const options = {
    onSuccess: done,
    onError: (failure: unknown) => setError(chatErrorMessage(failure)),
  };
  const submit = () => {
    const trimmed = text.trim();
    if (mode === "note")
      return sendNote.mutate({ id: conversationId, text: trimmed, clientMessageId }, options);
    if (file)
      return sendFile.mutate(
        { id: conversationId, file, caption: trimmed || undefined, clientMessageId },
        options,
      );
    sendText.mutate({ id: conversationId, text: trimmed, clientMessageId }, options);
  };
  const canSend = !pending && (mode === "reply" ? !!text.trim() || !!file : !!text.trim());

  return (
    <div className="border-border-default space-y-2 border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div role="radiogroup" aria-label="Loại tin" className="flex gap-1">
          {canReply && (
            <Button
              type="button"
              size="sm"
              variant={mode === "reply" ? "default" : "outline"}
              role="radio"
              aria-checked={mode === "reply"}
              onClick={() => setMode("reply")}
            >
              Trả lời khách
            </Button>
          )}
          {canNote && (
            <Button
              type="button"
              size="sm"
              variant={mode === "note" ? "default" : "outline"}
              role="radio"
              aria-checked={mode === "note"}
              onClick={() => setMode("note")}
            >
              Ghi chú nội bộ
            </Button>
          )}
        </div>
        {canUseCanned && canReply && mode === "reply" && (
          <CannedPicker
            conversationId={conversationId}
            onPick={(rendered) => {
              setText(rendered);
              setClientMessageId(crypto.randomUUID());
            }}
          />
        )}
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      <Textarea
        aria-label={mode === "note" ? "Ghi chú nội bộ" : "Tin nhắn cho khách"}
        placeholder={mode === "note" ? "Ghi chú nội bộ — khách không thấy" : "Nhập tin nhắn…"}
        value={text}
        maxLength={4000}
        rows={3}
        onChange={(event) => setText(event.target.value)}
        className={mode === "note" ? "bg-warning/10" : undefined}
      />
      <div className="flex items-center justify-between gap-2">
        {mode === "reply" ? (
          <label className="text-ink-secondary inline-flex cursor-pointer items-center gap-1 text-xs">
            <Paperclip className="size-3.5" />
            {file ? file.name : "Đính kèm (JPEG/PNG/WebP/PDF ≤ 20 MB)"}
            <input
              type="file"
              accept={ACCEPT}
              className="sr-only"
              aria-label="Đính kèm file"
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null;
                // BE FileCategory.CHAT_ATTACHMENT = 20 MB: chặn ngay, không tải lên để nhận 413.
                if (picked && picked.size > uploadFileMaxBytes("chatAttachment")) {
                  setFile(null);
                  setError(fileTooLargeMessage("chatAttachment"));
                  event.target.value = "";
                  return;
                }
                setError(null);
                setFile(picked);
              }}
            />
          </label>
        ) : (
          <span />
        )}
        <Button type="button" size="sm" disabled={!canSend} onClick={submit}>
          {pending ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}{" "}
          Gửi
        </Button>
      </div>
    </div>
  );
}
