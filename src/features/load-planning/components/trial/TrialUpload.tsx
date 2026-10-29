"use client";

import { useRef } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";

import { TRIAL_ACCEPT, TRIAL_LABELS, TRIAL_TEMPLATE } from "@/constants";
import { Button } from "@/components/ui/button";

interface TrialUploadProps {
  onPick: (file: File) => void;
  reading: boolean;
  fileName: string | null;
  error: string | null;
}

/** Bước 1: chọn file .xlsx (đọc ngay trong trình duyệt) hoặc tải file mẫu EasyCargo. Không gửi file lên máy chủ. */
export function TrialUpload({ onPick, reading, fileName, error }: TrialUploadProps) {
  const L = TRIAL_LABELS.upload;
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <h2 className="text-ink-primary text-sm font-semibold">{L.title}</h2>
      <p className="text-ink-secondary text-[0.8125rem]">{L.hint}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept={TRIAL_ACCEPT}
          className="sr-only"
          aria-label={L.choose}
          data-testid="trial-file-input"
          onChange={(event) => {
            const picked = event.target.files?.[0];
            // Cho phép chọn lại đúng file đó sau khi sửa nó
            event.target.value = "";
            if (picked) onPick(picked);
          }}
        />
        <Button type="button" size="sm" disabled={reading} onClick={() => input.current?.click()}>
          {reading ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <FileSpreadsheet className="size-3.5" aria-hidden="true" />
          )}
          {reading ? L.reading : fileName ? L.chooseAnother : L.choose}
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={TRIAL_TEMPLATE.href} download={TRIAL_TEMPLATE.downloadName}>
            <Download className="size-3.5" aria-hidden="true" />
            {L.template}
          </a>
        </Button>
        {fileName && <span className="text-ink-tertiary text-xs">{L.fileName(fileName)}</span>}
      </div>
      {error && (
        <p role="alert" className="text-danger text-[0.8125rem]">
          {error}
        </p>
      )}
    </div>
  );
}
