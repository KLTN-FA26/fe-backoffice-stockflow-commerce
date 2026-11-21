"use client";

import { Button } from "@/components/ui/button";

export type ComposerMode = "reply" | "note";

/** "Trả lời khách" / "Ghi chú nội bộ": only the kinds the viewer may send. */
export function ComposerModeToggle({
  mode,
  canReply,
  canNote,
  onChange,
}: {
  mode: ComposerMode;
  canReply: boolean;
  canNote: boolean;
  onChange: (mode: ComposerMode) => void;
}) {
  const option = (value: ComposerMode, label: string) => (
    <Button
      type="button"
      size="sm"
      variant={mode === value ? "default" : "outline"}
      role="radio"
      aria-checked={mode === value}
      onClick={() => onChange(value)}
    >
      {label}
    </Button>
  );
  return (
    <div role="radiogroup" aria-label="Loại tin" className="flex gap-1">
      {canReply && option("reply", "Trả lời khách")}
      {canNote && option("note", "Ghi chú nội bộ")}
    </div>
  );
}
