import { cn } from "cn";

import { Skeleton } from "@/components/shared/Skeleton";

interface PageSkeletonProps {
  variant?: "detail" | "form" | "list";
  className?: string;
}

const SKELETON_ITEMS = [0, 1, 2, 3, 4, 5] as const;

export function PageSkeleton({ variant = "list", className }: PageSkeletonProps) {
  return (
    <div
      className={cn("space-y-4", className)}
      role="status"
      aria-label="Đang tải nội dung"
      aria-busy="true"
    >
      <span className="sr-only">Đang tải nội dung</span>
      <SkeletonHeader />
      {variant === "list" && <ListSkeleton />}
      {variant === "form" && <FormSkeleton />}
      {variant === "detail" && <DetailSkeleton />}
    </div>
  );
}

function SkeletonHeader() {
  return (
    <div className="flex items-end justify-between gap-6 pb-2">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-64 max-w-[60vw]" />
        <Skeleton className="h-4 w-80 max-w-[72vw]" />
      </div>
      <Skeleton className="hidden h-9 w-28 sm:block" />
    </div>
  );
}

function ListSkeleton() {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-[var(--card-pad)]"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border">
        <div className="border-border-default flex items-center gap-3 border-b p-3">
          <Skeleton className="h-9 max-w-sm flex-1" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-9" />
        </div>
        <div className="border-border-default bg-bg-subtle grid grid-cols-[1.1fr_1.6fr_1fr_1fr_0.8fr] gap-4 border-b px-4 py-3">
          {[0, 1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-3 w-full max-w-24" />
          ))}
        </div>
        <div className="divide-border-default divide-y px-4">
          {SKELETON_ITEMS.map((item) => (
            <div
              key={item}
              className="grid grid-cols-[1.1fr_1.6fr_1fr_1fr_0.8fr] items-center gap-4 py-3"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full max-w-52" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="ml-auto h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <div className="border-border-default bg-bg-surface h-fit space-y-3 rounded-[var(--r-sm)] border p-[var(--card-pad)]">
        {SKELETON_ITEMS.slice(0, 5).map((item) => (
          <div key={item} className="flex items-center gap-3">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {[0, 1].map((section) => (
          <div
            key={section}
            className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-[var(--card-pad)]"
          >
            <Skeleton className="h-5 w-44" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((field) => (
                <div key={field} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-[var(--card-pad)]"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-6 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-[var(--card-pad)]">
          <Skeleton className="h-5 w-40" />
          <div className="mt-5 space-y-4">
            {SKELETON_ITEMS.map((item) => (
              <div key={item} className="flex items-center justify-between gap-6">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-48 max-w-[45%]" />
              </div>
            ))}
          </div>
        </div>
        <div className="border-border-default bg-bg-surface h-fit rounded-[var(--r-sm)] border p-[var(--card-pad)]">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-5 h-24 w-full" />
          <Skeleton className="mt-4 h-9 w-full" />
        </div>
      </div>
    </>
  );
}
