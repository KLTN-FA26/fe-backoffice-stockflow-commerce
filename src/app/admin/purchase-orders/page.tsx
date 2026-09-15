import { Suspense } from "react";

import { PurchaseOrderList } from "@/features/purchase-order/components/PurchaseOrderList";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <PurchaseOrderList />
    </Suspense>
  );
}
