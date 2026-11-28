import { Suspense } from "react";

import { AssignmentPage } from "@/features/sales-owner";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function SalesAssignmentRoute() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <AssignmentPage />
    </Suspense>
  );
}
