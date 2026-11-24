"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2 } from "lucide-react";

import { MODEL3D_VIEW_LABELS as LABELS } from "@/constants/labels-model3d";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";

/**
 * A titled panel of the visual check (the 3D model, the flat sheets) with "Phóng to" / "Thu nhỏ". Expanded, the panel
 * is portalled to `document.body` and fixed over the whole page: the view column is `sticky`, which makes its own
 * stacking context, so a fixed panel left inside it stays under the sidebar whatever its z-index. Its place in the page
 * keeps the same height meanwhile, so nothing jumps. The content mounts again when it moves (the 3D view is rebuilt).
 * Esc or "Thu nhỏ" brings it back; the page does not scroll behind it.
 */
export function ExpandablePanel({
  title,
  className,
  centered = false,
  children,
}: {
  title: string;
  className?: string;
  /** Center the content vertically: a short content (the flat sheet) next to a taller panel (the 3D stage). */
  centered?: boolean;
  /** Rendered with whether the panel is expanded, so the content can fill the screen. */
  children: (expanded: boolean) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [placeholderHeight, setPlaceholderHeight] = useState<number | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    if (!expanded) setPlaceholderHeight(panelRef.current?.offsetHeight ?? null);
    setExpanded((open) => !open);
  };

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    toggleRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  const panel = (
    <section
      ref={panelRef}
      aria-label={title}
      aria-modal={expanded || undefined}
      role={expanded ? "dialog" : undefined}
      className={cn(
        "border-border-default bg-bg-surface flex flex-col gap-3 rounded-[var(--card-radius)] border p-[var(--card-pad)]",
        expanded ? "fixed inset-4 z-(--z-modal) shadow-(--card-shadow)" : "min-w-0",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-ink-primary text-sm font-semibold">{title}</h4>
        <Button
          ref={toggleRef}
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={expanded}
          onClick={toggle}
        >
          {expanded ? (
            <Minimize2 aria-hidden className="size-3.5" />
          ) : (
            <Maximize2 aria-hidden className="size-3.5" />
          )}
          {expanded ? LABELS.collapse : LABELS.expand}
        </Button>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1",
          centered && "flex flex-col justify-center",
          expanded && "overflow-auto",
        )}
      >
        {children(expanded)}
      </div>
    </section>
  );

  if (!expanded) return panel;
  return (
    <>
      <div aria-hidden style={placeholderHeight ? { height: placeholderHeight } : undefined} />
      {/* `surface-soft`: the page's own token scope (card radius and shadow, action sizes). Portalled to `body`, the
          panel is outside the page wrapper and would fall back to the root tokens (square corners). */}
      {createPortal(
        <div className="surface-soft">
          <div aria-hidden className="bg-ink-primary/40 fixed inset-0 z-(--z-overlay)" onClick={toggle} />
          {panel}
        </div>,
        document.body,
      )}
    </>
  );
}
