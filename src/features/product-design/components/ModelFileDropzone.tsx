"use client";

import { Upload } from "lucide-react";
import { useId, useState } from "react";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { cn } from "cn";

import type { DragEvent } from "react";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.dropzone;

/**
 * The `.glb` box: a real file input (keyboard reachable, labelled) behind a label that covers the box, and a drag
 * highlight for files. Shut while a file is read or saved, so a second read never starts before the first ends.
 */
export function ModelFileDropzone({
  busy,
  replacing,
  onFile,
}: {
  busy: boolean;
  /** A configuration or a result already exists: the box offers another file. */
  replacing: boolean;
  onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputId = useId();
  const hintId = useId();

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
        // Taken even while busy: a file that is not swallowed makes the browser open it and leave.
        event.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "border-border-strong focus-within:ring-brand/30 focus-within:border-brand relative flex min-h-24 flex-col items-center justify-center gap-1 rounded-[var(--card-radius)] border border-dashed p-[var(--card-pad)] text-center focus-within:ring-[3px]",
        dragging ? "bg-bg-muted border-brand" : "bg-bg-surface",
        busy && "opacity-60",
      )}
    >
      <input
        id={inputId}
        type="file"
        accept=".glb,model/gltf-binary"
        disabled={busy}
        aria-describedby={hintId}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = ""; // the same file can be chosen again
          if (file) onFile(file);
        }}
      />
      <Upload aria-hidden className="text-ink-secondary size-5" />
      <label
        htmlFor={inputId}
        className="text-ink-primary cursor-pointer text-sm font-medium after:absolute after:inset-0"
      >
        {replacing ? TEXT.chooseAnother : TEXT.choose}
      </label>
      <p id={hintId} className="text-ink-tertiary text-xs">
        {TEXT.hint}
      </p>
    </div>
  );
}
