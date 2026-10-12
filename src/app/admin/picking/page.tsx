import { Suspense } from "react";

import { PickingList } from "@/features/fulfillment/components/TaskList";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function PickingPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <PickingList />
    </Suspense>
  );
}
