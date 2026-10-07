import { Suspense } from "react";

import { OrderList, OrderListPageSkeleton } from "@/features/order";

export default function OrdersPage() {
  return (
    <Suspense fallback={<OrderListPageSkeleton />}>
      <OrderList />
    </Suspense>
  );
}
