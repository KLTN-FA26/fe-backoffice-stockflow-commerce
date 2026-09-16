import { cn } from "cn";

import { Skeleton as ShadcnSkeleton } from "@/components/ui/skeleton";

import type { ComponentProps } from "react";

type SkeletonProps = ComponentProps<"div">;

/** StockFlow skin for the canonical shadcn skeleton primitive. */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <ShadcnSkeleton
      className={cn(
        "bg-bg-subtle ring-border-default/70 dark:bg-bg-muted/80 rounded-[var(--r-sm)] ring-1 ring-inset",
        className,
      )}
      {...props}
    />
  );
}
