import { Suspense } from "react";

import { CoversPage } from "@/features/sales-owner";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function SalesCoversRoute() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <CoversPage />
    </Suspense>
  );
}
