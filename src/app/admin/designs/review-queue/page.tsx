import { Suspense } from "react";

import { ReviewQueueList } from "@/features/design-review";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function DesignReviewQueuePage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ReviewQueueList />
    </Suspense>
  );
}
