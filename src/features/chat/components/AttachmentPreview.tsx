"use client";

import { useState } from "react";

import { SignedFilePreview } from "@/components/backoffice/SignedFilePreview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { chatErrorMessage } from "../mutations";
import { useAttachmentLink } from "../queries";

import type { ChatMessage } from "../schemas";

type Attachment = ChatMessage["attachments"][number];

export const isImageAttachment = (file: Pick<Attachment, "contentType">) =>
  file.contentType.startsWith("image/");

/**
 * Ảnh đính kèm xem ngay trong tin (52): thu nhỏ từ link tải tạm của BE, bấm để mở ảnh lớn. PDF không qua đây (giữ
 * nút tải). Link lỗi / hết hạn → "Lấy link mới" của `SignedFilePreview`; không lấy được link → câu lỗi tại chỗ.
 */
export function AttachmentPreview({
  conversationId,
  file,
}: {
  conversationId: string;
  file: Attachment;
}) {
  const [open, setOpen] = useState(false);
  const link = useAttachmentLink(conversationId, file.id, true);
  if (link.isError) {
    return (
      <p role="alert" className="text-danger text-xs">
        {chatErrorMessage(link.error)}
      </p>
    );
  }
  if (!link.data) {
    return (
      <div
        role="status"
        aria-label={`Đang tải ảnh ${file.fileName}`}
        className="bg-bg-muted size-32 animate-pulse rounded-[var(--r-sm)]"
      />
    );
  }
  const refresh = () => void link.refetch();
  return (
    <>
      <button
        type="button"
        aria-label={`Xem ảnh ${file.fileName}`}
        className="focus-visible:ring-accent block min-h-11 rounded-[var(--r-sm)] focus-visible:ring-2 focus-visible:outline-none"
        onClick={() => setOpen(true)}
      >
        <SignedFilePreview
          url={link.data.url}
          contentType={file.contentType}
          alt={file.fileName}
          size="thumb"
          onRefresh={refresh}
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{file.fileName}</DialogTitle>
            <DialogDescription>Ảnh khách / Sale gửi trong hội thoại.</DialogDescription>
          </DialogHeader>
          <SignedFilePreview
            url={link.data.url}
            contentType={file.contentType}
            alt={file.fileName}
            onRefresh={refresh}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
