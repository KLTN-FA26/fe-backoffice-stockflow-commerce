"use client";

import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon } from "lucide-react";

interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Tìm kiếm…",
  className,
  ...props
}: SearchBarProps) {
  return (
    <div className={cn("relative flex min-w-[200px] flex-1 items-center", className)}>
      <SearchIcon className="text-ink-tertiary pointer-events-none absolute left-[11px] size-4" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary hover:border-border-strong focus-visible:border-brand focus-visible:ring-brand/20 h-9 rounded-[var(--r-sm)] pr-3 pl-[34px] text-[0.875rem] shadow-none focus-visible:ring-[3px]"
        {...props}
      />
    </div>
  );
}
