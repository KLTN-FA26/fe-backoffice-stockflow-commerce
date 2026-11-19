import { FileBox, RefreshCw, X } from "lucide-react";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { formatFileSize } from "./format-size";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.chosenFile;

export interface ChosenFile {
  name: string;
  /** Bytes; `null` when the size is not known. */
  size: number | null;
  state: "reading" | "read" | "unreadable";
}

// Tone of the state, from the semantic tokens (as `Notice`): tint and dot in colour, the words in ink.
const STATE_TONE: Record<ChosenFile["state"], { badge: string; dot: string }> = {
  reading: { badge: "border-info/30 bg-info/5", dot: "bg-dot-info" },
  read: { badge: "border-warning/30 bg-warning/5", dot: "bg-dot-warning" },
  unreadable: { badge: "border-danger/30 bg-danger/5", dot: "bg-dot-danger" },
};
const ACTION_CLASS = "h-(--action-h) rounded-(--action-radius) px-(--action-px)";

/**
 * The row of the chosen `.glb` in place of the drop box: its name, size and state, "Đổi file" and "Bỏ file", and the
 * plain words that the file is not uploaded yet (a save sends it; after a save the row goes and the saved card names
 * the stored file).
 */
export function ChosenModelFile({
  file,
  busy,
  dragging,
  noteId,
  onChange,
  onDiscard,
}: {
  file: ChosenFile;
  busy: boolean;
  /** A file is dragged over the row: it will replace this one. */
  dragging: boolean;
  noteId: string;
  onChange: () => void;
  onDiscard: () => void;
}) {
  const tone = STATE_TONE[file.state];
  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-label={TEXT.label}
        className={cn(
          "border-border-default space-y-3 rounded-[var(--card-radius)] border p-3",
          dragging ? "bg-bg-muted border-brand" : "bg-bg-subtle",
        )}
      >
        {/* The file and its state on one line; the actions under it, so the name keeps its width in a narrow column. */}
        <div className="flex items-start gap-3">
          <FileBox aria-hidden className="text-accent mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-ink-primary truncate text-[0.8125rem] font-medium" title={file.name}>
              {file.name}
            </p>
            {file.size !== null && (
              <p className="text-ink-tertiary text-xs tabular-nums">{formatFileSize(file.size)}</p>
            )}
          </div>
          <span role="status" className="shrink-0">
            <Badge
              variant="outline"
              className={cn("text-ink-primary gap-1.5 whitespace-nowrap", tone.badge)}
            >
              <span aria-hidden className={cn("size-2 rounded-full", tone.dot)} />
              {TEXT.states[file.state]}
            </Badge>
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onChange}
            className={ACTION_CLASS}
          >
            <RefreshCw aria-hidden className="size-3.5" />
            {TEXT.change}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onDiscard}
            className={ACTION_CLASS}
          >
            <X aria-hidden className="size-3.5" />
            {TEXT.discard}
          </Button>
        </div>
      </div>
      <p id={noteId} className="text-ink-secondary text-xs">
        {file.state === "unreadable" ? TEXT.notUploadedUnreadable : TEXT.notUploaded}
      </p>
    </div>
  );
}
