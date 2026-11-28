import { Suspense } from "react";

import { LeadsPage } from "@/features/sales-owner";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function SalesLeadsRoute() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <LeadsPage />
    </Suspense>
  );
}
