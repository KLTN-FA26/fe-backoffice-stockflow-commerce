"use client";

import { WINDOW_CHANGE_LABELS as L } from "@/constants";

import { FormFieldError, RequiredMark } from "../FormFieldError";

import { WindowEvidenceFile } from "./WindowEvidenceFile";
import { WindowEvidenceMessage } from "./WindowEvidenceMessage";

import type { WindowChangeFormInput } from "../../delivery-window-schemas";
import type { EvidenceUpload } from "./useEvidenceUpload";

type Kind = WindowChangeFormInput["evidenceKind"];

interface WindowEvidenceFieldProps {
  kind: Kind;
  onKindChange: (kind: Kind) => void;
  upload: EvidenceUpload;
  order: { orderId: string };
  batchId: string;
  /** Id tin nhắn khách đã chọn ("" = chưa chọn) và đổi lựa chọn. */
  messageId: string;
  onMessageChange: (messageId: string) => void;
  /** Lỗi ô chọn tin nhắn (chưa chọn / không hợp lệ). */
  messageError: string | undefined;
  idPrefix: string;
}

const KINDS: readonly { kind: Kind; label: string }[] = [
  { kind: "file", label: L.evidenceKindFile },
  { kind: "message", label: L.evidenceKindMessage },
];

/**
 * Bằng chứng khách đồng ý (docs 17 BR-28): ĐÚNG MỘT trong hai — tệp (email, văn bản xác nhận; tải thẳng lên kho) hoặc
 * tin nhắn chat do CHÍNH khách gửi (chọn trong danh sách tin của khách, BE `…/window-change/evidence/messages`; nội dung +
 * giờ gửi, không bao giờ hiện hay bắt gõ mã tin nhắn). BE kiểm lại điều kiện của tin nhắn khi dời.
 */
export function WindowEvidenceField({
  kind,
  onKindChange,
  upload,
  order,
  batchId,
  messageId,
  onMessageChange,
  messageError,
  idPrefix,
}: WindowEvidenceFieldProps) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <fieldset className="border-border-default space-y-3 rounded-[var(--r-sm)] border p-3">
      <legend className="text-ink-secondary px-1 text-xs font-medium">
        {L.evidenceLabel} <RequiredMark />
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {KINDS.map((option) => (
          <label key={option.kind} className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={id("kind")}
              checked={kind === option.kind}
              onChange={() => onKindChange(option.kind)}
              className="accent-brand"
            />
            <span className="text-ink-primary text-[0.8125rem]">{option.label}</span>
          </label>
        ))}
      </div>
      {kind === "file" ? (
        <>
          <WindowEvidenceFile upload={upload} inputId={id("file")} describedBy={id("file-hint")} />
          <p id={id("file-hint")} className="text-ink-tertiary text-xs">
            {L.file.hint}
          </p>
        </>
      ) : (
        <div className="grid gap-1.5">
          <label htmlFor={id("message")} className="text-ink-secondary text-xs font-medium">
            {L.message.label}
          </label>
          <WindowEvidenceMessage
            id={id("message")}
            orderId={order.orderId}
            batchId={batchId}
            value={messageId}
            onChange={onMessageChange}
            hasError={!!messageError}
            describedBy={`${id("message-hint")}${messageError ? ` ${id("message-error")}` : ""}`}
          />
          <p id={id("message-hint")} className="text-ink-tertiary text-xs">
            {L.message.hint}
          </p>
          <FormFieldError id={id("message-error")} message={messageError} />
        </div>
      )}
    </fieldset>
  );
}
