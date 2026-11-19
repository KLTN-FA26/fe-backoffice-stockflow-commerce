"use client";

import { useId, useRef } from "react";
import { Film, Image as ImageIcon, Paperclip, X } from "lucide-react";

import { PRODUCTION_LABELS, SAMPLE_MEDIA_ACCEPT } from "@/constants";
import { formatDecimal } from "@/lib/format";

import { sampleFileProblems } from "@/features/production-order/sample-files";

import { Button } from "@/components/ui/button";

const S = PRODUCTION_LABELS.sample;

/**
 * Chọn ảnh / video mẫu (nhiều tệp). Kiểm loại / dung lượng / số tệp ngay khi chọn; danh sách có nút bỏ từng tệp.
 * Bấm nút → mở hộp chọn tệp của hệ điều hành (ô `input` ẩn có nhãn cho trình đọc màn hình).
 */
export function MediaPicker({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const problems = sampleFileProblems(files);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="text-ink-secondary text-xs font-medium">
          {S.files}{" "}
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        </label>
        <input
          ref={input}
          id={inputId}
          type="file"
          multiple
          accept={SAMPLE_MEDIA_ACCEPT}
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            onChange([...files, ...Array.from(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          <Paperclip className="size-3.5" /> {S.pickFiles}
        </Button>
      </div>
      <p className="text-ink-tertiary text-xs">{S.filesHint}</p>
      {files.length > 0 && (
        <ul className="divide-y divide-(--table-line) text-[0.8125rem]">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center gap-2 py-1">
              {file.type.startsWith("video/") ? (
                <Film className="text-ink-tertiary size-3.5" aria-hidden="true" />
              ) : (
                <ImageIcon className="text-ink-tertiary size-3.5" aria-hidden="true" />
              )}
              <span className="text-ink-primary min-w-0 flex-1 truncate">{file.name}</span>
              <span className="text-ink-tertiary text-xs tabular-nums">
                {formatDecimal(file.size / (1024 * 1024), 1)} MB
              </span>
              <button
                type="button"
                aria-label={S.removeFile(file.name)}
                disabled={disabled}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                className="text-ink-tertiary hover:text-ink-primary focus-visible:ring-border-strong rounded-sm p-0.5 focus-visible:ring-2 focus-visible:outline-none"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {problems.map((problem, index) => (
        // Hai tệp trùng tên cùng lỗi cho cùng một câu — khoá theo vị trí
        <p key={index} role="alert" className="text-danger text-xs">
          {problem}
        </p>
      ))}
    </div>
  );
}
