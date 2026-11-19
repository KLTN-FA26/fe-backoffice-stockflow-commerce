"use client";

import { Upload } from "lucide-react";
import { useId, useRef, useState } from "react";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { cn } from "cn";

import { ChosenModelFile } from "./ChosenModelFile";

import type { DragEvent } from "react";
import type { ChosenFile } from "./ChosenModelFile";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.dropzone;
const CHOSEN = PRINT_CONFIG_SCREEN_LABELS.chosenFile;

/**
 * The `.glb` chooser: one real file input (keyboard reachable, labelled) for both looks, kept in place so focus survives
 * the switch. With no file chosen it is the drop box, whose label covers the box; once a file is chosen (reading, read
 * or unreadable) the box gives way to the row of that file, whose "Đổi file" opens the same input. A file dropped on
 * either replaces the choice. Shut while a file is read or saved, so a second read never starts before the first ends.
 */
export function ModelFilePicker({
  busy,
  replacing,
  chosen,
  onFile,
  onDiscard,
}: {
  busy: boolean;
  /** A configuration is saved: the box offers a file to replace its file. */
  replacing: boolean;
  /** The file in play, or `null` when none is chosen. */
  chosen: ChosenFile | null;
  onFile: (file: File) => void;
  onDiscard: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const hintId = useId();
  const noteId = useId();

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
      className="relative"
    >
      <input
        ref={input}
        id={inputId}
        type="file"
        accept=".glb,model/gltf-binary"
        disabled={busy}
        // In the row the "Đổi file" button is the keyboard stop; the input keeps a name of its own.
        tabIndex={chosen ? -1 : undefined}
        aria-label={chosen ? CHOSEN.changeInput : undefined}
        aria-describedby={chosen ? noteId : hintId}
        className="peer sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = ""; // the same file can be chosen again
          if (file) onFile(file);
        }}
      />
      {chosen ? (
        <ChosenModelFile
          file={chosen}
          busy={busy}
          dragging={dragging}
          noteId={noteId}
          onChange={() => input.current?.click()}
          onDiscard={() => {
            onDiscard();
            input.current?.focus(); // the row goes away: the keyboard stays on the chooser
          }}
        />
      ) : (
        <div
          className={cn(
            "border-border-strong peer-focus:ring-brand/30 peer-focus:border-brand relative flex min-h-24 flex-col items-center justify-center gap-1 rounded-[var(--card-radius)] border border-dashed p-[var(--card-pad)] text-center peer-focus:ring-[3px]",
            dragging ? "bg-bg-muted border-brand" : "bg-bg-surface",
            busy && "opacity-60",
          )}
        >
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
      )}
    </div>
  );
}
