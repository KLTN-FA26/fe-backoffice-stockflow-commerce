import { Suspense } from "react";

import { CreditHoldList, OrderListPageSkeleton } from "@/features/order";

export default function CreditHoldsPage() {
  return (
    <Suspense fallback={<OrderListPageSkeleton />}>
      <CreditHoldList />
    </Suspense>
  );
}
