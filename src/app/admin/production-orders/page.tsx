import { Suspense } from "react";

import { ProductionList } from "@/features/production-order";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function ProductionOrdersPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ProductionList />
    </Suspense>
  );
}
