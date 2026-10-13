"use client";

import React from "react";
import { cn } from "cn";
import { STATUS_LABEL_VI, toneOf, type SemanticTone } from "@/lib/status-map";
import type { StatusDomain } from "@/lib/mock-data";

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
  domain?: StatusDomain;
  label?: string;
  size?: "sm" | "md";
}

const BADGE_TONE_STYLES: Record<SemanticTone, string> = {
  positive:
    "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
  info: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800",
  warning:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
  danger:
    "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
  special:
    "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",
  muted:
    "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-400 dark:border-slate-800",
  neutral:
    "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700",
};

const DOT_TONE_STYLES: Record<SemanticTone, string> = {
  positive: "bg-emerald-500",
  info: "bg-sky-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  special: "bg-purple-500",
  muted: "bg-slate-400",
  neutral: "bg-slate-500",
};

export function StatusBadge({
  status,
  domain: _domain,
  label,
  size = "sm",
  className,
  ...props
}: StatusBadgeProps) {
  const tone = toneOf(status);
  const displayLabel = label || STATUS_LABEL_VI[status] || status;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap transition-colors",
        size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        BADGE_TONE_STYLES[tone],
        className,
      )}
      {...props}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT_TONE_STYLES[tone])} />
      <span>{displayLabel}</span>
    </span>
  );
}
