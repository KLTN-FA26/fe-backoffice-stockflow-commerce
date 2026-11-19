"use client";

import { useState } from "react";

import { CHAT_ATTACHABLE_CONTEXTS, CHAT_CONTEXT_LABELS } from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField } from "@/components/shared/FormField";

import { chatErrorMessage, useAttachContext } from "../mutations";
import { attachableDocuments } from "../selectors";

import type { ChatAttachableContext } from "@/constants";
import type { ChatConversation, ChatCustomerOverview } from "../schemas";

const toKind = (value: string): ChatAttachableContext | null =>
  CHAT_ATTACHABLE_CONTEXTS.find((kind) => kind === value) ?? null;

/**
 * Gắn chứng từ vào hội thoại (S13, 16 BR-02): chọn trong hồ sơ khách (S16) nên chỉ có chứng từ của chính khách;
 * bản nháp được. Chứng từ đã gắn không hiện lại.
 */
export function AttachContextDialog({
  conversation,
  overview,
  open,
  onOpenChange,
}: {
  conversation: ChatConversation;
  overview: ChatCustomerOverview | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const attach = useAttachContext();
  const [kind, setKind] = useState<ChatAttachableContext>("QUOTE");
  const [refId, setRefId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setRefId("");
    setError(null);
    onOpenChange(false);
  };
  const attached = new Set(
    conversation.contexts.map((context) => `${context.kind}:${context.refId}`),
  );
  const documents = attachableDocuments(overview, kind).filter(
    (document) => !attached.has(`${kind}:${document.id}`),
  );

  return (
    <FormDialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      {open && (
        <FormDialogBody
          title="Gắn chứng từ"
          description="Chứng từ gắn vào hội thoại để Sale khác mở cuộc trò chuyện là thấy ngay."
          submitLabel="Gắn"
          canSubmit={!!refId}
          isPending={attach.isPending}
          error={error}
          onCancel={close}
          onSubmit={() =>
            attach.mutate(
              { id: conversation.id, kind, refId },
              { onSuccess: close, onError: (failure) => setError(chatErrorMessage(failure)) },
            )
          }
        >
          <FormField id="attach-kind" label="Loại chứng từ" required>
            <select
              id="attach-kind"
              value={kind}
              onChange={(event) => {
                const next = toKind(event.target.value);
                if (next) setKind(next);
                setRefId("");
              }}
              className={`${FORM_INPUT_CLASS} border px-2`}
            >
              {CHAT_ATTACHABLE_CONTEXTS.map((value) => (
                <option key={value} value={value}>
                  {CHAT_CONTEXT_LABELS[value] ?? value}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            id="attach-document"
            label="Chứng từ"
            required
            hint={documents.length === 0 ? "Khách không có chứng từ loại này chưa gắn." : undefined}
          >
            <select
              id="attach-document"
              value={refId}
              disabled={documents.length === 0}
              onChange={(event) => setRefId(event.target.value)}
              className={`${FORM_INPUT_CLASS} border px-2`}
            >
              <option value="">Chọn chứng từ</option>
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.label}
                </option>
              ))}
            </select>
          </FormField>
        </FormDialogBody>
      )}
    </FormDialog>
  );
}
