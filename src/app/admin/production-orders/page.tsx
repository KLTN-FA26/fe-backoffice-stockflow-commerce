import { Suspense } from "react";

import { ProductionOrderList } from "@/features/production-order/components/ProductionOrderList";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function ProductionOrdersPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ProductionOrderList />
    </Suspense>
  );
}
