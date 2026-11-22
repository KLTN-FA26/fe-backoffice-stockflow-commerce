"use client";

import { AtSign, Lock, MessageSquareText } from "lucide-react";

import { CHAT_COMPOSER_LABELS } from "@/constants";
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
      {value === "note" && <Lock className="size-3.5" />}
      {label}
    </Button>
  );
  return (
    <div role="radiogroup" aria-label={CHAT_COMPOSER_LABELS.modeGroup} className="flex gap-1">
      {canReply && option("reply", CHAT_COMPOSER_LABELS.replyMode)}
      {canNote && option("note", CHAT_COMPOSER_LABELS.noteMode)}
    </div>
  );
}

/**
 * BO-UX-43: always says, in words and with an icon, where the text goes — the background tint alone is not enough
 * (WCAG 1.4.1), and a note typed in reply mode would reach the customer. The textarea points at it
 * (`aria-describedby`), so a screen reader hears the mode with the field.
 */
export function ComposerModeBanner({ id, mode }: { id: string; mode: ComposerMode }) {
  const note = mode === "note";
  const Icon = note ? Lock : MessageSquareText;
  return (
    <p
      id={id}
      aria-live="polite"
      className={`flex items-center gap-2 rounded-[var(--r-sm)] border px-2 py-1 text-xs font-medium ${
        note
          ? "border-warning/40 bg-warning/10 text-ink-primary"
          : "border-border-default bg-bg-subtle text-ink-primary"
      }`}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {note ? CHAT_COMPOSER_LABELS.noteBanner : CHAT_COMPOSER_LABELS.replyBanner}
    </p>
  );
}

/** BO-UX-43: a reply to the customer that @mentions someone was probably meant as an internal note. */
export function ReplyMentionWarning({ onSwitch }: { onSwitch: () => void }) {
  return (
    <div
      role="status"
      className="border-warning/40 bg-warning/10 text-ink-primary flex flex-wrap items-center gap-2 rounded-[var(--r-sm)] border px-2 py-1 text-xs"
    >
      <AtSign aria-hidden className="size-3.5 shrink-0" />
      <span className="flex-1">{CHAT_COMPOSER_LABELS.mentionInReply}</span>
      <Button type="button" size="sm" variant="outline" onClick={onSwitch}>
        <Lock className="size-3.5" />
        {CHAT_COMPOSER_LABELS.switchToNote}
      </Button>
    </div>
  );
}
