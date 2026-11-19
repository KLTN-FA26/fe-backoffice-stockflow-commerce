"use client";

import { useId, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "cn";

import { SHIPPING_FILE_LABELS, SHIPPING_FILE_RULES } from "@/constants/shipping-files";

import type { DragEvent } from "react";
import type { ShippingFileKind } from "@/constants/shipping-files";

/** Hộp chọn file: nút thật (bàn phím được) + kéo thả. Khoá khi đang tải để không bắt đầu lần hai trước khi lần một xong. */
export function UploadBox({
  kind,
  busy,
  onFile,
}: {
  kind: ShippingFileKind;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputId = useId();
  const hintId = useId();
  const L = SHIPPING_FILE_LABELS[kind];
  const C = SHIPPING_FILE_LABELS.common;

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !busy) onFile(file);
  };

  return (
    <div
      onDragOver={(event) => {
        if (!Array.from(event.dataTransfer.types).includes("Files")) return;
        // Nhận cả khi bận: file không được nuốt thì trình duyệt mở nó và rời màn
        event.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "border-border-strong focus-within:ring-brand/30 focus-within:border-brand relative flex flex-col items-center justify-center gap-1 rounded-[var(--card-radius)] border border-dashed p-[var(--card-pad)] text-center focus-within:ring-[3px]",
        dragging ? "bg-bg-muted border-brand" : "bg-bg-surface",
        busy && "opacity-60",
      )}
    >
      <input
        id={inputId}
        type="file"
        accept={SHIPPING_FILE_RULES[kind].accept}
        disabled={busy}
        aria-describedby={hintId}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = ""; // chọn lại đúng file đó vẫn nhận
          if (file) onFile(file);
        }}
      />
      <Upload aria-hidden className="text-ink-secondary size-5" />
      <label
        htmlFor={inputId}
        className="text-ink-primary cursor-pointer text-sm font-medium after:absolute after:inset-0"
      >
        {L.upload}
      </label>
      <p id={hintId} className="text-ink-tertiary text-xs">
        {C.chooseHint} · {L.typeHint}
      </p>
    </div>
  );
}
