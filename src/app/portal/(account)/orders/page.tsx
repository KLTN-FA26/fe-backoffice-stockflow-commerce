import { Suspense } from "react";

import { PortalOrderList } from "@/features/customer-order";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function PortalOrdersPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <PortalOrderList />
    </Suspense>
  );
}
