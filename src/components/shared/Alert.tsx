import { cn } from "cn";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { ReactNode } from "react";

type AlertTone = "info" | "warning" | "danger";

interface AlertProps {
  tone: AlertTone;
  title?: string;
  children: ReactNode;
  className?: string;
}

const TONE_CONFIG: Record<AlertTone, { icon: typeof Info; classes: string }> = {
  info: {
    icon: Info,
    classes:
      "text-info bg-[color-mix(in_srgb,var(--info)_10%,transparent)] border-[color-mix(in_srgb,var(--info)_26%,transparent)]",
  },
  warning: {
    icon: AlertTriangle,
    classes:
      "text-warning bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] border-[color-mix(in_srgb,var(--warning)_26%,transparent)]",
  },
  danger: {
    icon: AlertCircle,
    classes:
      "text-danger bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] border-[color-mix(in_srgb,var(--danger)_26%,transparent)]",
  },
};

export function Alert({ tone, title, children, className }: AlertProps) {
  const { icon: Icon, classes } = TONE_CONFIG[tone];

  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-[var(--r-sm)] border px-3.5 py-2.5 text-[0.8125rem]",
        classes,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>
        {title && <strong className="text-ink-primary">{title}</strong>}
        {title && " "}
        {children}
      </div>
    </div>
  );
}
