"use client";

import { useId, useRef, useState } from "react";
import { LoaderCircle, Lock, Send } from "lucide-react";

import { CHAT_COMPOSER_LABELS } from "@/constants";
import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { useChatFailure, useSendAttachment, useSendNote, useSendText } from "../mutations";
import { CannedPicker } from "./CannedPicker";
import { ComposerAttachment } from "./ComposerAttachment";
import { ComposerModeBanner, ComposerModeToggle, ReplyMentionWarning } from "./ComposerModeToggle";
import { MentionPicker } from "./MentionPicker";
import { looksLikeMention, useMentionComposer } from "./use-mention-composer";

import type { ComposerMode } from "./ComposerModeToggle";

/**
 * Soạn tin: "Trả lời khách" (S5) hoặc "Ghi chú nội bộ" (S6, khách không thấy, có @nhắc đồng nghiệp); kèm file (S7). Mỗi
 * lần gửi một `clientMessageId` mới; bấm lại sau lỗi dùng lại để BE không tạo tin trùng. Câu trả lời mẫu chèn vào ô trả
 * lời khách để sửa trước khi gửi. BO-UX-43: chế độ nói bằng chữ ở thanh báo cố định và ở nút gửi ("Gửi cho khách" /
 * "Lưu ghi chú nội bộ"), không chỉ bằng màu nền; trả lời khách mà có @nhắc thì cảnh báo.
 */
export function Composer({
  conversationId,
  canReply,
  canNote,
  canUseCanned = false,
  replyBlockedHint = null,
}: {
  conversationId: string;
  canReply: boolean;
  canNote: boolean;
  canUseCanned?: boolean;
  /** Không phải người phụ trách: chỉ còn ghi chú nội bộ, kèm câu này. */
  replyBlockedHint?: string | null;
}) {
  const describeError = useChatFailure();
  const [chosen, setMode] = useState<ComposerMode>(canReply ? "reply" : "note");
  // Mất quyền trả lời (đổi người phụ trách) giữa chừng → rơi về ghi chú nội bộ.
  const mode: ComposerMode = chosen === "reply" && !canReply ? "note" : chosen;
  const note = mode === "note";
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientMessageId, setClientMessageId] = useState(() => crypto.randomUUID());
  const area = useRef<HTMLTextAreaElement>(null);
  const bannerId = useId();
  const mention = useMentionComposer({ enabled: mode === "note", text, setText, area });
  const sendText = useSendText();
  const sendNote = useSendNote();
  const sendFile = useSendAttachment();
  const pending = sendText.isPending || sendNote.isPending || sendFile.isPending;
  if (!canReply && !canNote) return null;

  const options = {
    onSuccess: () => {
      setText("");
      mention.reset();
      setFile(null);
      setError(null);
      setClientMessageId(crypto.randomUUID());
    },
    onError: (failure: unknown) => setError(describeError(failure)),
  };
  const submit = () => {
    const trimmed = text.trim();
    if (mode === "note") {
      const mentions = mention.mentionIds(trimmed);
      return sendNote.mutate(
        { id: conversationId, text: trimmed, clientMessageId, mentions },
        options,
      );
    }
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
        <ComposerModeToggle mode={mode} canReply={canReply} canNote={canNote} onChange={setMode} />
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
      {!canReply && replyBlockedHint && (
        <p className="text-ink-tertiary text-xs">{replyBlockedHint}</p>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
      <ComposerModeBanner id={bannerId} mode={mode} />
      <Textarea
        ref={area}
        aria-label={note ? CHAT_COMPOSER_LABELS.noteField : CHAT_COMPOSER_LABELS.replyField}
        aria-describedby={bannerId}
        placeholder={
          note ? CHAT_COMPOSER_LABELS.notePlaceholder : CHAT_COMPOSER_LABELS.replyPlaceholder
        }
        value={text}
        maxLength={4000}
        rows={3}
        {...mention.textareaProps}
        onChange={(event) => {
          setText(event.target.value);
          mention.track(event.target.value, event.target.selectionStart);
        }}
        className={note ? "bg-warning/10" : undefined}
      />
      {mention.picking && <MentionPicker {...mention.pickerProps} />}
      {!note && canNote && looksLikeMention(text) && (
        <ReplyMentionWarning onSwitch={() => setMode("note")} />
      )}
      <div className="flex items-center justify-between gap-2">
        {mode === "reply" ? (
          <ComposerAttachment file={file} onFile={setFile} onError={setError} />
        ) : (
          <span />
        )}
        <Button type="button" size="sm" disabled={!canSend} onClick={submit}>
          {pending ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : note ? (
            <Lock className="size-3.5" />
          ) : (
            <Send className="size-3.5" />
          )}{" "}
          {note ? CHAT_COMPOSER_LABELS.sendNote : CHAT_COMPOSER_LABELS.sendReply}
        </Button>
      </div>
    </div>
  );
}
