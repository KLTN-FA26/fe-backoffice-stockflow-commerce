"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, CHAT_ATTACHABLE_CONTEXTS, CHAT_CONTEXT_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { CustomerPicker } from "@/components/backoffice/CustomerPicker";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { chatErrorMessage, useOpenConversation } from "../mutations";
import { useCustomerOverview } from "../queries";
import { attachableDocuments } from "../selectors";

import type { ChatAttachableContext } from "@/constants";

const SUBJECT_MAX = 200;
const TEXT_MAX = 4000;
const NO_CONTEXT = "";

const toKind = (value: string): ChatAttachableContext | null =>
  CHAT_ATTACHABLE_CONTEXTS.find((kind) => kind === value) ?? null;

/** BE (404) → câu nói rõ chứng từ / khách nào không hợp lệ; mã khác dùng câu chung của chat. */
function openErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "CHAT_CONTEXT_NOT_FOUND") return "Chứng từ này không thuộc khách đã chọn.";
    if (error.code === "CUSTOMER_NOT_FOUND") return "Không tìm thấy khách hàng.";
  }
  return chatErrorMessage(error);
}

/** Hộp thoại chỉ gắn form khi mở: đóng là quên hết, và mỗi lần mở có `clientMessageId` mới. */
export function OpenConversationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && <OpenConversationForm onClose={() => onOpenChange(false)} />}
    </FormDialog>
  );
}

/**
 * Sale tự mở hội thoại với khách (BE `POST /chat/conversations`, `chat-conversations:CREATE`): chọn khách, có thể gắn
 * một chứng từ của khách (chọn trong hồ sơ S16, BE từ chối chứng từ không của khách) và gửi luôn tin đầu. Xong →
 * mở hội thoại vừa tạo. Mỗi lần mở hộp thoại dùng một `clientMessageId` để bấm gửi lại không đăng tin hai lần.
 */
function OpenConversationForm({ onClose: close }: { onClose: () => void }) {
  const router = useRouter();
  const openConversation = useOpenConversation();
  const [customerId, setCustomerId] = useState("");
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState<ChatAttachableContext>("QUOTE");
  const [refId, setRefId] = useState(NO_CONTEXT);
  const [text, setText] = useState("");
  const [clientMessageId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const overview = useCustomerOverview(customerId || undefined);
  const documents = attachableDocuments(overview.data, kind);

  const submit = () => {
    setError(null);
    const message = text.trim();
    openConversation.mutate(
      {
        customerId,
        ...(subject.trim() ? { subject: subject.trim() } : {}),
        ...(refId ? { contextKind: kind, contextId: refId } : {}),
        ...(message ? { text: message, clientMessageId } : {}),
      },
      {
        onSuccess: (created) => {
          close();
          router.push(ADMIN_ROUTES.chat.detail(created.id));
        },
        onError: (failure) => setError(openErrorMessage(failure)),
      },
    );
  };

  return (
    <FormDialogBody
      title="Mở hội thoại mới"
      description="Nhắn khách trước: hội thoại được giao cho bạn nếu bạn trả lời khách, không thì vào hàng chờ."
      submitLabel="Mở hội thoại"
      canSubmit={!!customerId}
      isPending={openConversation.isPending}
      error={error}
      onCancel={close}
      onSubmit={submit}
    >
      <CustomerPicker
        value={customerId}
        onChange={(next) => {
          setCustomerId(next);
          setRefId(NO_CONTEXT);
        }}
        idPrefix="chat-open"
      />
      <FormField id="chat-open-subject" label="Chủ đề" hint="Không bắt buộc.">
        <Input
          id="chat-open-subject"
          maxLength={SUBJECT_MAX}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className={FORM_INPUT_CLASS}
        />
      </FormField>
      {customerId && (
        <>
          <FormField id="chat-open-kind" label="Về chứng từ" hint="Không bắt buộc.">
            <select
              id="chat-open-kind"
              value={kind}
              onChange={(event) => {
                const next = toKind(event.target.value);
                if (next) setKind(next);
                setRefId(NO_CONTEXT);
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
            id="chat-open-document"
            label="Chứng từ"
            error={overview.isError ? chatErrorMessage(overview.error) : undefined}
            hint={
              overview.isSuccess && documents.length === 0
                ? "Khách không có chứng từ loại này."
                : undefined
            }
          >
            <select
              id="chat-open-document"
              value={refId}
              disabled={overview.isPending || documents.length === 0}
              onChange={(event) => setRefId(event.target.value)}
              className={`${FORM_INPUT_CLASS} border px-2`}
            >
              <option value={NO_CONTEXT}>
                {overview.isPending ? "Đang tải…" : "Không gắn chứng từ"}
              </option>
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.label}
                </option>
              ))}
            </select>
          </FormField>
        </>
      )}
      <FormField id="chat-open-text" label="Tin đầu tiên" hint="Không bắt buộc.">
        <Textarea
          id="chat-open-text"
          rows={3}
          maxLength={TEXT_MAX}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </FormField>
    </FormDialogBody>
  );
}
