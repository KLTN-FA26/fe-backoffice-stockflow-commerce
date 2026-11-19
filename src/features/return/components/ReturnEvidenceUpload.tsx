"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";

import { RETURN_LABELS } from "@/constants/labels-return";
import { RETURN_LIMITS } from "@/constants/returns";
import { DirectUploadError, uploadFileDirect } from "@/lib/api/direct-upload";
import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";

import { beginReturnEvidenceUpload } from "../api";
import { returnEvidenceErrorMessage } from "../errors";
import { useAttachReturnEvidence } from "../mutations";
import { evidenceFileProblem } from "../selectors";

import type { ReturnRequest } from "../types";

const D = RETURN_LABELS.detail;
const MAX = RETURN_LIMITS.evidenceMax;

/**
 * Sale thêm ảnh của khiếu nại thay khách (BE `sales-rmas:CREATE`, stage CLAIM): kiểm loại / cỡ ở trình duyệt, xin đường
 * tải (`/evidence/uploads`) → PUT thẳng lên kho → gắn `uploadId` vào yêu cầu (`/evidence`). Đủ ảnh thì khoá nút (BE vẫn
 * chặn `RETURN_EVIDENCE_LIMIT_REACHED`). Rời màn thì huỷ tải.
 */
export function ReturnEvidenceUpload({ ret }: { ret: ReturnRequest }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attach = useAttachReturnEvidence();
  const full = (ret.evidence?.length ?? 0) >= MAX;

  useEffect(() => () => controller.current?.abort(), []);

  const upload = async (file: File) => {
    const problem = evidenceFileProblem(file);
    setError(problem);
    if (problem) return;
    const current = new AbortController();
    controller.current = current;
    setUploading(file.name);
    try {
      const uploadId = await uploadFileDirect({
        file,
        signal: current.signal,
        declare: (declaration, signal) => beginReturnEvidenceUpload(ret.id, declaration, signal),
      });
      await attach.mutateAsync({ id: ret.id, uploadId });
    } catch (failure: unknown) {
      if (!(failure instanceof DirectUploadError && failure.kind === "aborted"))
        setError(returnEvidenceErrorMessage(failure));
    } finally {
      setUploading(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading !== null || full}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="size-3.5" aria-hidden /> {D.addPhoto}
        </Button>
        <span className="text-ink-tertiary text-xs" aria-live="polite">
          {uploading ? D.photoUploading(uploading) : full ? D.photoLimit(MAX) : D.photoHint(MAX)}
        </span>
      </div>
      <label htmlFor={inputId} className="sr-only">
        {D.addPhoto}
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={RETURN_LIMITS.evidenceTypes.join(",")}
        className="sr-only"
        tabIndex={-1}
        disabled={uploading !== null || full}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {error && (
        <Notice tone="danger" live>
          {error}
        </Notice>
      )}
    </div>
  );
}
