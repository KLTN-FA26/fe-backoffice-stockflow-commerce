import { Suspense } from "react";

import { DeliveryFailureList, OrderListPageSkeleton } from "@/features/order";

export default function DeliveryFailuresPage() {
  return (
    <Suspense fallback={<OrderListPageSkeleton />}>
      <DeliveryFailureList />
    </Suspense>
  );
}
