import { Suspense } from "react";

import { PackingList } from "@/features/fulfillment/components/TaskList";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function PackingPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <PackingList />
    </Suspense>
  );
}
