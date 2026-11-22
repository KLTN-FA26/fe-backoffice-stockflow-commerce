"use client";

import { Paperclip } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import type { Ref } from "react";

const L = UI_LABELS.filePicker;

/**
 * Ô chọn tệp dùng chung: nút "Chọn tệp" + tên tệp đã chọn, thay cho ô `<input type="file">` gốc của trình duyệt (chữ
 * "Choose File / No file chosen" theo ngôn ngữ trình duyệt, không tiếng Việt). Không chứa nghiệp vụ — kiểm tra loại /
 * dung lượng tệp do nơi dùng làm. Ô nhập thật vẫn có id + a11y để `FormField` / nhãn trỏ vào.
 */
export function FilePickerField({
  id,
  accept,
  fileName,
  onChange,
  disabled,
  inputRef,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  id: string;
  accept?: string;
  /** Tên tệp đang chọn (state của nơi dùng); `null` / rỗng = chưa chọn. */
  fileName?: string | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  /** Để nơi dùng xoá giá trị ô chọn (chọn lại cùng tệp vẫn kích hoạt). */
  inputRef?: Ref<HTMLInputElement>;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <Button
        variant="outline"
        size="sm"
        asChild
        className={`cursor-pointer rounded-[var(--r-sm)] ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <label htmlFor={id} aria-disabled={disabled || undefined}>
          <Paperclip className="size-3.5" /> {fileName ? L.change : L.choose}
        </label>
      </Button>
      <span
        className={`min-w-0 text-[0.8125rem] break-all ${fileName ? "text-ink-primary" : "text-ink-tertiary"}`}
      >
        {fileName || L.none}
      </span>
    </div>
  );
}
