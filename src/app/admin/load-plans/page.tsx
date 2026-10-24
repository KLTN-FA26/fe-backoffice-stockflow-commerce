import { Suspense } from "react";

import { LoadPlanList } from "@/features/load-planning/components/LoadPlanList";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function LoadPlansPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <LoadPlanList />
    </Suspense>
  );
}
