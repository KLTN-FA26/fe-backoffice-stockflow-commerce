"use client";

import { cn } from "cn";
import { Check, ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";

import { UI_LABELS } from "@/constants";

import type { KeyboardEvent } from "react";

/** Một dòng của cây trong `TreeSelect`: mũi tên mở / thu (nhánh) hoặc khoảng trống (lá) + dòng chọn. */
export function TreeSelectRow({
  label,
  hint,
  depth,
  selected,
  disabled,
  expanded,
  onToggle,
  onSelect,
  onKeyDown,
}: {
  label: string;
  hint?: string;
  depth: number;
  selected: boolean;
  disabled?: boolean;
  /** undefined = nút lá (không có mũi tên). */
  expanded?: boolean;
  onToggle?: () => void;
  onSelect: () => void;
  onKeyDown?: (event: KeyboardEvent) => void;
}) {
  const isBranch = expanded !== undefined;
  const FolderIcon = isBranch && expanded ? FolderOpen : Folder;
  return (
    <div
      className="flex items-center gap-0.5"
      style={{ paddingInlineStart: `${depth * 1.125}rem` }}
    >
      {isBranch && onToggle ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={
            expanded ? UI_LABELS.treeSelect.collapse(label) : UI_LABELS.treeSelect.expand(label)
          }
          onClick={onToggle}
          className="text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary flex size-6 shrink-0 items-center justify-center rounded-[var(--r-sm)]"
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      ) : (
        <span className="size-6 shrink-0" aria-hidden />
      )}
      <button
        type="button"
        role="treeitem"
        aria-selected={selected}
        aria-expanded={isBranch ? expanded : undefined}
        aria-level={depth + 1}
        disabled={disabled}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        className={cn(
          "hover:bg-bg-muted focus-visible:bg-bg-muted flex min-w-0 flex-1 items-center gap-2 rounded-[var(--r-sm)] px-1.5 py-1.5 text-left text-[0.8125rem] outline-none disabled:pointer-events-none disabled:opacity-50",
          selected && "bg-bg-muted text-ink-primary font-medium",
        )}
      >
        <FolderIcon className="text-ink-tertiary size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
        {hint && (
          <span className="text-ink-tertiary shrink-0 font-[family-name:var(--font-mono)] text-xs">
            {hint}
          </span>
        )}
        {selected && <Check className="text-ink-primary ml-auto size-3.5 shrink-0" aria-hidden />}
      </button>
    </div>
  );
}
