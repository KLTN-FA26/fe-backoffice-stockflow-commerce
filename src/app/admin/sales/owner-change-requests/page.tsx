import { Suspense } from "react";

import { RequestsPage } from "@/features/sales-owner";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function OwnerChangeRequestsRoute() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <RequestsPage />
    </Suspense>
  );
}
