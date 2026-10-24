"use client";

import { REPORTING_LABELS } from "@/constants/reporting";

import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";

const L = REPORTING_LABELS;

/** Card with the three states every report widget needs: skeleton, error + retry, empty. */
export function ReportCard({
  title,
  isPending,
  isError,
  isEmpty,
  onRetry,
  skeletonClass = "h-[280px]",
  className,
  children,
}: {
  title: string;
  isPending: boolean;
  isError: boolean;
  isEmpty: boolean;
  onRetry: () => void;
  skeletonClass?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={`border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-[var(--card-shadow)] ${className ?? ""}`}
    >
      <h3 className="text-ink-primary mb-3 text-[0.875rem] font-semibold">{title}</h3>
      {isPending ? (
        <Skeleton className={`${skeletonClass} w-full`} aria-busy="true" />
      ) : isError ? (
        <div role="alert" className="text-danger flex flex-wrap items-center gap-2 text-sm">
          {L.loadError}
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onRetry}>
            {L.retry}
          </Button>
        </div>
      ) : isEmpty ? (
        <EmptyState title={L.emptyTitle} description={L.emptyDescription} />
      ) : (
        children
      )}
    </section>
  );
}
