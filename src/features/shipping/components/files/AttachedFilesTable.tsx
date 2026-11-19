"use client";

import { Download, FileText } from "lucide-react";

import { SHIPPING_FILE_LABELS } from "@/constants/shipping-files";
import { formatDateTime } from "@/lib/format/date";
import { Button } from "@/components/ui/button";

import { fileTypeLabel, formatFileSize } from "../../attached-files";
import { MONO } from "../primitives";

import type { ShippingFileKind } from "@/constants/shipping-files";
import type { AttachedFile } from "../../attached-files-schemas";

const TH = "px-3 py-2 text-left font-medium whitespace-nowrap";

function FileRow({
  file,
  opening,
  onDownload,
}: {
  file: AttachedFile;
  opening: boolean;
  onDownload: (file: AttachedFile) => void;
}) {
  const C = SHIPPING_FILE_LABELS.common;
  return (
    <tr className="border-border-default border-t align-top">
      <td className="text-ink-primary px-3 py-2 font-medium break-all">
        <span className="inline-flex items-start gap-1.5">
          <FileText aria-hidden className="text-ink-tertiary mt-0.5 size-3.5 shrink-0" />
          {file.fileName}
        </span>
      </td>
      <td className="text-ink-secondary px-3 py-2 whitespace-nowrap">
        {fileTypeLabel(file.contentType)}
      </td>
      <td className={`text-ink-secondary px-3 py-2 whitespace-nowrap ${MONO}`}>
        {formatFileSize(file.sizeBytes)}
      </td>
      <td className="text-ink-secondary px-3 py-2 whitespace-nowrap tabular-nums">
        {formatDateTime(file.uploadedAt)}
      </td>
      <td className="px-3 py-2 text-right">
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={opening}
          aria-label={`${C.download} ${file.fileName}`}
          onClick={() => onDownload(file)}
        >
          <Download className="size-3" /> {opening ? C.downloading : C.download}
        </Button>
      </td>
    </tr>
  );
}

/** Bảng file đã đính kèm: tên, loại, dung lượng, thời điểm tải lên, nút Tải xuống mỗi dòng. */
export function AttachedFilesTable({
  kind,
  files,
  opening,
  onDownload,
}: {
  kind: ShippingFileKind;
  files: readonly AttachedFile[];
  opening: string | null;
  onDownload: (file: AttachedFile) => void;
}) {
  const C = SHIPPING_FILE_LABELS.common;
  return (
    <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
      <table className="w-full text-[0.8125rem]">
        <caption className="sr-only">{SHIPPING_FILE_LABELS[kind].title}</caption>
        <thead className="bg-bg-subtle text-ink-secondary">
          <tr>
            <th scope="col" className={TH}>
              {C.columns.name}
            </th>
            <th scope="col" className={TH}>
              {C.columns.type}
            </th>
            <th scope="col" className={TH}>
              {C.columns.size}
            </th>
            <th scope="col" className={TH}>
              {C.columns.uploadedAt}
            </th>
            <th scope="col" className="sr-only">
              {C.columns.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <FileRow
              key={file.fileId}
              file={file}
              opening={opening === file.fileId}
              onDownload={onDownload}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
