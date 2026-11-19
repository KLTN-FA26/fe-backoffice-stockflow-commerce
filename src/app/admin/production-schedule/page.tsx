import { Suspense } from "react";

import { ProductionSchedule } from "@/features/production-order/components/schedule/ProductionSchedule";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function ProductionSchedulePage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ProductionSchedule />
    </Suspense>
  );
}
