import { Suspense } from "react";

import { CancellationRequestList, OrderListPageSkeleton } from "@/features/order";

export default function CancellationRequestsPage() {
  return (
    <Suspense fallback={<OrderListPageSkeleton />}>
      <CancellationRequestList />
    </Suspense>
  );
}
