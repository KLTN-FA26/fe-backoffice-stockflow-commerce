import { Suspense } from "react";

import { MyTripPage } from "@/features/putaway";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

export default function PutawayTripRoute() {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <MyTripPage />
    </Suspense>
  );
}
