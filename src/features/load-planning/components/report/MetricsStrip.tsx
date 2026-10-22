import { cn } from "cn";

import type { ReactNode } from "react";

export type MetricTone = "default" | "good" | "warn" | "bad";

export interface MetricItem {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: MetricTone;
}

const TONE_CLASS: Record<MetricTone, string> = {
  default: "text-ink-primary",
  good: "text-positive",
  warn: "text-warning",
  bad: "text-danger",
};

/** Dải số liệu có icon (số xe, kiện, thể tích, hiệu suất…) — chỉ trình bày. (Gốc: `result-metrics.tsx`.) */
export function MetricsStrip({
  items,
  className,
}: {
  items: readonly MetricItem[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "border-border-default grid grid-cols-2 gap-x-6 gap-y-3 border-y py-3 xl:grid-cols-6",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 items-center gap-2">
          {item.icon && <div className="text-ink-tertiary shrink-0">{item.icon}</div>}
          <div className="min-w-0">
            <dt className="text-ink-tertiary text-[11px] uppercase">{item.label}</dt>
            <dd
              className={cn("truncate text-sm font-semibold", TONE_CLASS[item.tone ?? "default"])}
            >
              {item.value}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
