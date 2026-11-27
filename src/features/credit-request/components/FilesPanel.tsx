"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";

import { CREDIT_REQUEST_LIMITS } from "@/constants/credit-request";
import { formatDateTime } from "@/lib/format/date";
import { DetailPanel } from "@/components/shared/DetailPanel";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { getCreditRequestFileUrl } from "../api";
import { creditRequestErrorMessage, useAttachCreditRequestFile } from "../mutations";
import { fileSizeText } from "../selectors";

import type { CreditRequest } from "../types";

/**
 * Giấy tờ của đề nghị (PDF, Word, Excel, JPEG, PNG; ≤ 25 MB; ≤ 10 tệp; chỉ thêm khi còn mở — BE re-check). Tải về qua
 * link ngắn hạn.
 */
export function FilesPanel({ request, canAttach }: { request: CreditRequest; canAttach: boolean }) {
  const files = request.files ?? [];
  const attach = useAttachCreditRequestFile();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const full = files.length >= CREDIT_REQUEST_LIMITS.filesMax;

  const onPick = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (file.size > CREDIT_REQUEST_LIMITS.fileBytesMax) {
      setError("Tệp vượt 25 MB.");
      return;
    }
    attach.mutate(
      { id: request.id, file },
      { onError: (e) => setError(creditRequestErrorMessage(e)) },
    );
  };
  const download = async (fileId: string) => {
    try {
      window.open(await getCreditRequestFileUrl(request.id, fileId), "_blank", "noopener");
    } catch (e: unknown) {
      toast.error(creditRequestErrorMessage(e));
    }
  };

  return (
    <DetailPanel
      title="Giấy tờ"
      count={files.length}
      description="PDF, Word, Excel, JPEG, PNG — mỗi tệp ≤ 25 MB, tối đa 10 tệp."
      actions={
        canAttach && (
          <>
            <input
              ref={input}
              type="file"
              className="sr-only"
              aria-label="Chọn giấy tờ"
              accept={CREDIT_REQUEST_LIMITS.accept}
              onChange={(e) => {
                onPick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={attach.isPending || full}
              onClick={() => input.current?.click()}
            >
              <Upload className="size-3.5" /> {attach.isPending ? "Đang tải…" : "Tải giấy tờ"}
            </Button>
          </>
        )
      }
    >
      {error && (
        <p role="alert" className="text-danger mb-2 text-[0.8125rem]">
          {error}
        </p>
      )}
      {files.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">Chưa có giấy tờ.</p>
      ) : (
        <ul className="divide-y divide-(--table-line) text-[0.8125rem]">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 py-2">
              <span className="text-ink-primary min-w-0 flex-1 truncate" title={file.fileName}>
                {file.fileName}
              </span>
              <span className="text-ink-tertiary text-xs tabular-nums">
                {fileSizeText(file.sizeBytes)} · {formatDateTime(file.uploadedAt)}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Tải ${file.fileName}`}
                onClick={() => void download(file.id)}
              >
                <Download className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </DetailPanel>
  );
}
