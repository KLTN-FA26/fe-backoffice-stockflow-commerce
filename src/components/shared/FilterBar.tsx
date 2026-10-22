"use client";

import { cn } from "cn";
import { Button } from "@/components/ui/button";

interface FilterChip {
  label: string;
  value: string;
}

interface FilterBarProps {
  chips: FilterChip[];
  active?: string;
  onChange?: (value: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export function FilterBar({ chips, active, onChange, className, children }: FilterBarProps) {
  return (
    <div
      className={cn(
        "border-border-default bg-bg-subtle flex flex-wrap items-center gap-2 rounded-[var(--r-sm)] border p-3",
        className,
      )}
    >
      {chips.map((chip) => {
        const isActive = chip.value === active;
        return (
          <Button
            key={chip.value}
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={isActive}
            onClick={() => onChange?.(chip.value)}
            className={cn(
              "h-7 rounded-full px-3 text-[0.8125rem] transition-colors duration-150",
              isActive
                ? "border-brand bg-brand text-ink-inverse hover:bg-brand hover:text-ink-inverse font-medium"
                : "border-border-default bg-bg-surface text-ink-secondary hover:border-accent hover:bg-bg-surface",
            )}
          >
            {chip.label}
          </Button>
        );
      })}
      {children}
    </div>
  );
}
