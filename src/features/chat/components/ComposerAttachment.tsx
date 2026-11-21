"use client";

import { Paperclip } from "lucide-react";

import { fileTooLargeMessage, uploadFileMaxBytes } from "@/constants/upload-limits";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

/** "Đính kèm" of the reply composer (S7): one file; too large → the error, nothing uploaded. */
export function ComposerAttachment({
  file,
  onFile,
  onError,
}: {
  file: File | null;
  onFile: (file: File | null) => void;
  onError: (message: string | null) => void;
}) {
  return (
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
            onFile(null);
            onError(fileTooLargeMessage("chatAttachment"));
            event.target.value = "";
            return;
          }
          onError(null);
          onFile(picked);
        }}
      />
    </label>
  );
}
