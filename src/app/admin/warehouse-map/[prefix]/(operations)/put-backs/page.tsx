import { Suspense } from "react";

import { PutBackScreen } from "@/features/fulfillment/components/put-back/PutBackScreen";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function PutBacksPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <PutBackScreen />
    </Suspense>
  );
}
