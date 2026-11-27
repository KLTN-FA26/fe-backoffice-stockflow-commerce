"use client";

import { WINDOW_CHANGE_LABELS as L } from "@/constants";

import { RequiredMark } from "../FormFieldError";

import { WindowEvidenceFile } from "./WindowEvidenceFile";

import type { EvidenceUpload } from "./useEvidenceUpload";

interface WindowEvidenceFieldProps {
  upload: EvidenceUpload;
  idPrefix: string;
}

/**
 * Bằng chứng khách đồng ý (docs 17 BR-28): tệp (email, văn bản xác nhận; tải thẳng lên kho). BR-28 còn cho "tin nhắn chat
 * do chính khách gửi", nhưng BE chưa có endpoint liệt kê tin nhắn nên cách đó bắt người dùng dán UUID — ẩn đi (WF4 UX
 * S06-9). Form vẫn giữ nhánh `evidenceMessageId` (schema, lịch sử dời) để bật lại khi BE có danh sách tin nhắn để chọn.
 */
export function WindowEvidenceField({ upload, idPrefix }: WindowEvidenceFieldProps) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <fieldset className="border-border-default space-y-3 rounded-[var(--r-sm)] border p-3">
      <legend className="text-ink-secondary px-1 text-xs font-medium">
        {L.evidenceLabelFile} <RequiredMark />
      </legend>
      <WindowEvidenceFile upload={upload} inputId={id("file")} describedBy={id("file-hint")} />
      <p id={id("file-hint")} className="text-ink-tertiary text-xs">
        {L.file.hint}
      </p>
    </fieldset>
  );
}
