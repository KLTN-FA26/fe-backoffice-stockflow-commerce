"use client";

import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";

/** Nút phóng to / thu nhỏ góc bản đồ — icon-only nên có `aria-label` + tooltip. */
export function ZoomButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="border-border-default bg-bg-surface text-ink-primary size-8 rounded-(--control-radius) shadow-(--control-shadow)"
    >
      {children}
    </Button>
  );
}
