import { Suspense } from "react";

import { OrderList } from "@/features/order/components/OrderList";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function OrdersPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <OrderList />
    </Suspense>
  );
}
