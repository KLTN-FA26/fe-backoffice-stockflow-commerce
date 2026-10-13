import { Suspense } from "react";

import { WorkshopPage } from "@/features/production-order";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function WorkshopRoute() {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <WorkshopPage />
    </Suspense>
  );
}
