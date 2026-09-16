import { cn } from "cn";

import { STATUS_LABEL_VI, toneOf } from "@/lib/status-map";

import type { StatusDomain, SemanticTone } from "@/lib/mock-data";

interface StatusDotProps {
  domain: StatusDomain;
  status: string;
  size?: "sm" | "md";
  withIcon?: boolean;
  className?: string;
}

const DOT_TONE_CLASSES: Record<SemanticTone, string> = {
  danger: "bg-danger",
  info: "bg-info",
  muted: "bg-muted-tone",
  neutral: "bg-neutral",
  positive: "bg-positive",
  special: "bg-special",
  warning: "bg-warning",
};

export function StatusDot({ domain, status, size = "sm", className }: StatusDotProps) {
  void domain;
  const tone = toneOf(status);
  const labelVi = STATUS_LABEL_VI[status];
  const title = labelVi ? `${labelVi} — ${status}` : status;

  return (
    <span
      className={cn(
        "text-ink-primary inline-flex items-center gap-2 leading-[1.4] font-medium whitespace-nowrap",
        size === "sm" ? "text-[0.8125rem]" : "text-[0.9375rem]",
        className,
      )}
      title={title}
    >
      <span
        className={cn(
          "shrink-0 rounded-full",
          size === "sm" ? "size-2.5" : "size-3",
          DOT_TONE_CLASSES[tone],
        )}
      />
      {labelVi ?? status}
    </span>
  );
}
