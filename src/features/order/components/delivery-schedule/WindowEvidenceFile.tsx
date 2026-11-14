"use client";

import { Paperclip } from "lucide-react";
import { useRef } from "react";

import { WINDOW_CHANGE_LABELS, WINDOW_EVIDENCE_FILE } from "@/constants";
import { Button } from "@/components/ui/button";

import type { EvidenceUpload } from "./useEvidenceUpload";

const F = WINDOW_CHANGE_LABELS.file;

/** Câu trạng thái của lần tải đang chạy (kiểm tra → chuẩn bị → % tải lên). */
function runningText(state: Extract<EvidenceUpload["state"], { status: "running" }>): string {
  if (state.stage === "hashing") return F.hashing;
  if (state.stage === "declaring") return F.declaring;
  return F.uploading(state.percent);
}

/**
 * Chọn + tải tệp bằng chứng: tải ngay khi chọn, hiện tiến độ, lỗi tiếng Việt kèm nút thử lại / bỏ tệp. Chọn lại cùng một
 * tệp sau lỗi vẫn kích hoạt (giá trị ô chọn được xoá sau mỗi lần).
 */
export function WindowEvidenceFile({
  upload,
  inputId,
  describedBy,
}: {
  upload: EvidenceUpload;
  inputId: string;
  describedBy: string;
}) {
  const { state, start, cancel } = upload;
  const input = useRef<HTMLInputElement>(null);
  const running = state.status === "running";
  return (
    <div className="space-y-2">
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={WINDOW_EVIDENCE_FILE.accept}
        aria-label={F.label}
        aria-describedby={describedBy}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void start(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={running}
          onClick={() => input.current?.click()}
          className="rounded-[var(--r-sm)]"
        >
          <Paperclip className="size-3.5" /> {state.status === "idle" ? F.choose : F.change}
        </Button>
        {state.status !== "idle" && (
          <Button type="button" variant="ghost" size="sm" onClick={cancel}>
            {F.remove}
          </Button>
        )}
      </div>
      {state.status === "running" && (
        <div className="space-y-1">
          <p role="status" className="text-ink-secondary text-xs break-all">
            {state.fileName} — {runningText(state)}
          </p>
          <div
            role="progressbar"
            aria-label={F.label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={state.stage === "uploading" ? state.percent : 0}
            className="bg-bg-muted h-1.5 overflow-hidden rounded-full"
          >
            <div
              className="bg-accent h-full transition-[width]"
              style={{ width: `${state.stage === "uploading" ? state.percent : 0}%` }}
            />
          </div>
        </div>
      )}
      {state.status === "done" && (
        <p role="status" className="text-success text-xs break-all">
          {F.done(state.fileName)}
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-danger text-xs break-words">
          {state.fileName} — {state.message}
        </p>
      )}
    </div>
  );
}
