import { Skeleton } from "@/components/shared/Skeleton";

/** The section while its configuration loads: a header line, a two-column figures block, a table. */
export function PrintConfigSkeleton() {
  return (
    <div aria-busy="true" className="space-y-3">
      <Skeleton className="h-5 w-40" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-24" />
    </div>
  );
}
