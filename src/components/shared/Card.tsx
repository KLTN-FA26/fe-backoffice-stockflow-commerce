import { cn } from "cn";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "bg-bg-surface border-border-default transition-colors duration-200",
        "rounded-[var(--card-radius)] p-[var(--card-pad)] shadow-[var(--card-shadow)]",
        "border",
        className,
      )}
    >
      {children}
    </div>
  );
}
