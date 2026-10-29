import { cn } from "cn";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border-strong bg-bg-surface flex flex-col items-center justify-center rounded-[var(--card-radius)] border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <div className="text-ink-tertiary mb-2.5 text-2xl">
        {icon ?? <Inbox className="size-8" />}
      </div>
      <h4 className="text-ink-primary font-[family-name:var(--font-display)] text-[1.05rem] font-semibold">
        {title}
      </h4>
      {description && (
        <p className="text-ink-secondary mx-auto mt-1 max-w-[42ch] text-[0.8125rem]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
