import { Suspense } from "react";

import { LoadPlanCreate } from "@/features/load-planning/components/create/LoadPlanCreate";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function CreateLoadPlanPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <LoadPlanCreate />
    </Suspense>
  );
}
