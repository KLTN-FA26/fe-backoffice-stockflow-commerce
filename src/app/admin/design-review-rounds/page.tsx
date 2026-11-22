import { Suspense } from "react";

import { ReviewRoundList } from "@/features/design-review";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function DesignReviewRoundsPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ReviewRoundList />
    </Suspense>
  );
}
