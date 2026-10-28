import { Suspense } from "react";

import { LoadPlanDetail } from "@/features/load-planning/components/LoadPlanDetail";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default async function LoadPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <LoadPlanDetail id={id} />
    </Suspense>
  );
}
