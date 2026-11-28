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
 * Bằng chứng khách đồng ý (docs 17 BR-28): ĐÚNG MỘT trong hai — tệp (email, văn bản xác nhận; tải thẳng lên kho) hoặc
 * mã tin nhắn chat do CHÍNH khách gửi trong cuộc chat của khách (đơn này hoặc chưa gắn đơn). Người dùng có thể chọn
 * tin ở chat để form điền sẵn, hoặc dán mã; BE kiểm lại (400 nếu tin của nhân viên / khách khác / đơn khác).
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
